// Analytics: anonymous counts only, off while developing, never carrying link contents.
// The game is served from disk under a public-looking host so the hook is active; hits are captured, not sent.
const fs = require("fs");
const path = require("path");
const { test, expect, stubSharing, answerCurrent } = require("./helpers");

const ROOT = path.resolve(__dirname, "..");
const SITE = "https://mugnut.example/Mugnut/";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".webmanifest": "application/manifest+json" };

async function serveAsPublicSite(context) {
  await context.route("https://mugnut.example/**", route => {
    const rel = new URL(route.request().url()).pathname.replace(/^\/Mugnut\//, "") || "index.html";
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
    route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
  });
}
const hits = async page => (await page.evaluate(() => window.__hits)).map(u => {
  const url = new URL(u);
  return { origin: url.origin, path: url.pathname, ...Object.fromEntries(url.searchParams) };
});
const events = async page => (await hits(page)).filter(h => h.e === "true").map(h => h.p);

test.beforeEach(async ({ context }) => { await stubSharing(context); });

test("nothing is counted on a local server", async ({ page }) => {
  await page.goto("./");
  await page.locator('#levelBtns .lvbtn[data-lv="1"]').click();
  await answerCurrent(page, true);
  await page.locator("#quitBtn").click();
  await page.locator("#dailyBtn").click();
  await answerCurrent(page, true);
  const local = /^(127\.|localhost)/.test(new URL(page.url()).hostname);
  test.skip(!local, "only meaningful against the local server");
  expect(await page.evaluate(() => window.__hits)).toEqual([]);
});

test.describe("on a public host", () => {
  test.beforeEach(async ({ context }) => { await serveAsPublicSite(context); });

  test("one page view on load, with only anonymous fields", async ({ page }) => {
    await page.goto(SITE);
    await expect(page.locator("#home")).toBeVisible();
    const all = await hits(page);
    expect(all).toHaveLength(1);
    const h = all[0];
    expect(h.origin).toBe("https://mugnut.goatcounter.com");
    expect(h.path).toBe("/count");
    expect(h.p).toBe("/");
    expect(h.e).toBeUndefined();
    expect(Object.keys(h).sort()).toEqual(["b", "origin", "p", "path", "rnd", "s", "t"]); // b marks this automated browser
  });

  test("rounds, the daily object and its share button are counted by fixed names", async ({ page }) => {
    await page.goto(SITE);
    await page.locator('#levelBtns .lvbtn[data-lv="1"]').click();
    for (let i = 0; i < 10; i++) { await answerCurrent(page, true); await page.locator("#nextBtn").click(); }
    await expect(page.locator("#end")).toBeVisible();
    await page.locator("#homeBtn").click();

    await page.locator("#journeyBtn").click();
    await page.locator("#ilGo").click();
    for (let i = 0; i < 3; i++) { await answerCurrent(page, false); await page.locator("#nextBtn").click(); }
    await expect(page.locator("#end")).toBeVisible();
    await page.locator("#homeBtn").click();

    await page.locator("#dailyBtn").click();
    await answerCurrent(page, true);
    await page.locator("#nextBtn").click();
    await page.locator("#againBtn").click();
    await page.locator("#homeBtn").click();
    // replaying the locked daily object is not a second play
    await page.locator("#dailyBtn").click();
    await page.locator("#nextBtn").click();

    expect(await events(page)).toEqual([
      "round-start-level-1", "round-finish-level-1",
      "round-start-journey", "round-finish-journey",
      "daily-played", "share-daily",
    ]);
  });

  test("the challenge flow is counted, and no hit ever carries names, answers or link data", async ({ page, browser }, testInfo) => {
    const { newPhone, lastCopied } = require("./helpers");
    await page.goto(SITE);
    await page.locator("#friendsBtn").click();
    await page.locator("#newChBtn").click();
    await page.locator("#galIn").setInputFiles(path.join(__dirname, "fixtures", "photo.jpg"));
    await expect(page.locator("#previewCard")).toBeVisible();
    await page.locator("#chName").fill("Secretkeyring");
    await page.locator('#chOpts .opt[data-g="1"]').click();
    await page.locator("#chNote").fill("Secretnote");
    await page.locator("#myName").fill("Secretalice");
    await page.locator("#postBtn").click();
    await expect(page.locator("#share")).toBeVisible();
    await page.locator("#shCopy").click();
    const link = (await lastCopied(page)).split("\n").pop();
    expect(await events(page)).toEqual(["challenge-created", "share-challenge"]);

    const ctx = await newPhone(browser, testInfo);
    await serveAsPublicSite(ctx);
    const bob = await ctx.newPage();
    await bob.goto(link);
    await expect(bob.locator("#play")).toBeVisible();
    await bob.locator('#plOpts .opt[data-g="1"]').click();
    await bob.locator("#plMyName").fill("Secretbob");
    await bob.locator("#plReply").click();
    await bob.locator("#shCopy").click();
    expect(await events(bob)).toEqual(["challenge-opened", "challenge-answered", "share-reply"]);
    // opening the same link again is not a second "opened"
    await bob.goto(SITE);
    await bob.goto(link);
    await expect(bob.locator("#play")).toBeVisible();
    expect(await events(bob)).toEqual([]); // fresh page load: only its page view, no events

    for (const p of [page, bob]) {
      const raw = (await p.evaluate(() => window.__hits)).join("\n");
      expect(raw).not.toMatch(/secret/i);
      expect(raw).not.toContain("#c=");
      expect(raw).not.toContain(link.split("#c=")[1].slice(0, 20));
      for (const h of await hits(p)) expect(h.r === undefined || !h.r.includes("#")).toBe(true);
    }
    await ctx.close();
  });

  test("nothing is counted when the browser asks not to be tracked", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "globalPrivacyControl", { value: true, configurable: true }));
    await page.goto(SITE);
    await page.locator('#levelBtns .lvbtn[data-lv="1"]').click();
    await answerCurrent(page, true);
    expect(await page.evaluate(() => window.__hits)).toEqual([]);
  });

  test("an empty site code switches analytics off", async ({ page, context }) => {
    await context.route(SITE, route => {
      const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
      expect(html).toContain('const ANALYTICS = "mugnut";');
      route.fulfill({ status: 200, contentType: "text/html", body: html.replace('const ANALYTICS = "mugnut";', 'const ANALYTICS = "";') });
    });
    await page.goto(SITE);
    await page.locator("#journeyBtn").click();
    await expect(page.locator("#interlude")).toBeVisible();
    expect(await page.evaluate(() => window.__hits)).toEqual([]);
  });

  test("the page loads no third-party scripts and sets no cookies", async ({ page, context }) => {
    const foreign = [];
    page.on("request", r => { if (!r.url().startsWith("https://mugnut.example/") && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) foreign.push(r.url()); });
    await page.goto(SITE);
    await page.locator("#dailyBtn").click();
    await answerCurrent(page, true);
    expect(foreign).toEqual([]);
    expect(await context.cookies()).toEqual([]);
  });
});
