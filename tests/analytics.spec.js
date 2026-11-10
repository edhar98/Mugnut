// Analytics: anonymous counts only, off while developing, never carrying link contents.
// The hook only fires on the live site's host, so the tests serve the local files under that address from disk
// (every request to it is answered here, nothing reaches the network); hits are captured, not sent.
const fs = require("fs");
const path = require("path");
const { test, expect, stubSharing, answerCurrent } = require("./helpers");

const ROOT = path.resolve(__dirname, "..");
const SITE = "https://edhar98.github.io/Mugnut/";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".webmanifest": "application/manifest+json" };

async function serveAsPublicSite(context) {
  await context.route("https://edhar98.github.io/**", route => {
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

test.describe("on the live site's address", () => {
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
      expect(decodeURIComponent(decodeURIComponent(raw))).not.toContain(link.split("#c=")[1].slice(0, 20));
      // every hit is one of the fixed names with only the anonymous fields
      for (const h of await hits(p)) {
        expect(h.p).toMatch(/^(\/|[a-z]+(-[a-z0-9]+)*)$/);
        expect(Object.keys(h).filter(k => !["origin", "path", "p", "t", "s", "rnd", "e", "b"].includes(k))).toEqual([]);
      }
    }
    await ctx.close();
  });

  for (const [signal, value] of [["globalPrivacyControl", true], ["doNotTrack", "1"]]) {
    test(`nothing is counted when the browser asks not to be tracked (${signal})`, async ({ page }) => {
      await page.addInitScript(([k, v]) => Object.defineProperty(navigator, k, { value: v, configurable: true }), [signal, value]);
      await page.goto(SITE);
      await page.locator('#levelBtns .lvbtn[data-lv="1"]').click();
      await answerCurrent(page, true);
      expect(await page.evaluate(() => window.__hits)).toEqual([]);
    });
  }

  test("a referring page's address never reaches the counter, only its host name", async ({ page, context }) => {
    // A link wrapper that carries the whole challenge link and an email in its own query string, and asks for full referrers.
    const secretLink = SITE + "#c=SECRETPAYLOADabc.PHOTOPREVIEW";
    const wrapper = "https://wrapper.example/redirect?to=" + encodeURIComponent(secretLink) + "&user=alice@example.com";
    await context.route("https://wrapper.example/**", route => route.fulfill({ status: 200, contentType: "text/html",
      body: `<meta name="referrer" content="unsafe-url"><a id="go" href="${SITE}">continue</a>` }));
    await page.goto(wrapper);
    await page.locator("#go").click();
    await expect(page.locator("#home")).toBeVisible();
    const sawFull = await page.evaluate(() => document.referrer.includes("SECRETPAYLOAD"));
    const raw = decodeURIComponent(decodeURIComponent((await page.evaluate(() => window.__hits)).join("\n")));
    expect(raw).not.toMatch(/SECRETPAYLOAD|PHOTOPREVIEW|alice|redirect|#c=/);
    const [view] = await hits(page);
    expect(view.r).toBe("wrapper.example");
    // Chromium honours the wrapper's unsafe-url policy, so there the full address really was available to the page.
    if (page.context().browser().browserType().name() === "chromium") expect(sawFull).toBe(true);
  });

  test("moving around inside the game does not report the game as its own referrer", async ({ page }) => {
    await page.goto(SITE);
    await page.evaluate(() => { location.href = location.href + "?x=1"; });
    await expect(page.locator("#home")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.referrer)).toContain("edhar98.github.io");
    const [view] = await hits(page);
    expect(view.r).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain("x=1");
  });

  test("a copy of the game on any other public host counts nothing", async ({ page, context }) => {
    await context.route("https://someone.example/**", route => route.fulfill({ status: 200, contentType: "text/html", body: fs.readFileSync(path.join(ROOT, "index.html")) }));
    await page.goto("https://someone.example/Mugnut/");
    await page.locator("#journeyBtn").click();
    await expect(page.locator("#interlude")).toBeVisible();
    expect(await page.evaluate(() => window.__hits)).toEqual([]);
  });

  test("when beacons are unavailable the hit goes out as an image request, with the same anonymous fields", async ({ page, context }) => {
    const seen = [];
    await context.route(/goatcounter\.com/, route => { seen.push(route.request().url()); route.abort(); });
    await page.addInitScript(() => Object.defineProperty(navigator, "sendBeacon", { value: () => false, configurable: true }));
    const errors = [];
    page.on("pageerror", e => errors.push(String(e)));
    await page.goto(SITE);
    await page.locator("#journeyBtn").click();
    await expect.poll(() => seen.length).toBe(2);
    expect(seen.map(u => new URL(u).searchParams.get("p"))).toEqual(["/", "round-start-journey"]);
    await expect(page.locator("#interlude")).toBeVisible(); // the failed image did not disturb the game
    expect(errors).toEqual([]);
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
    page.on("request", r => { if (!r.url().startsWith("https://edhar98.github.io/") && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) foreign.push(r.url()); });
    await page.goto(SITE);
    await page.locator("#dailyBtn").click();
    await answerCurrent(page, true);
    expect(foreign).toEqual([]);
    expect(await context.cookies()).toEqual([]);
  });
});
