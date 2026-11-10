// Service worker: build stamp and offline play.
const { test, expect } = require("./helpers");
const { compute } = require("../tools/stamp");

test("the build stamp in sw.js matches the shipped files", async () => {
  const { current, wanted } = compute();
  expect(current, "sw.js is stale: run `npm run stamp`").toBe(wanted);
});

test("the served service worker names its cache after the build stamp", async ({ request }) => {
  const sw = await (await request.get("sw.js")).text();
  expect(sw).toMatch(/const BUILD = "[0-9a-f]{10}";/);
  expect(sw).toContain('const CACHE = "mugnut-" + BUILD;');
});

test("every file the service worker caches is tracked by git", async () => {
  const { execFileSync } = require("child_process");
  const root = require("path").resolve(__dirname, "..");
  const sw = require("fs").readFileSync(root + "/sw.js", "utf8");
  const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n");
  for (const f of JSON.parse(sw.match(/const FILES = (\[[\s\S]*?\]);/)[1]).filter(f => f !== "./")) expect(tracked, f).toContain(f);
});

test("the service worker caches every script the page loads and every language it can switch to", async ({ page, request }) => {
  await page.goto("./");
  const sw = await (await request.get("sw.js")).text();
  const files = JSON.parse(sw.match(/const FILES = (\[[\s\S]*?\]);/)[1]);
  const scripts = await page.evaluate(() => [...document.querySelectorAll("script[src]")].map(s => s.getAttribute("src")));
  const langs = await page.evaluate(() => Object.keys(LANGS).filter(l => l !== "en").map(l => `lang/${l}.js`));
  expect(scripts.length).toBeGreaterThan(5);
  for (const f of [...scripts, ...langs, "index.html", "manifest.webmanifest"]) expect(files, f).toContain(f);
});

test.describe("offline", () => {
  test.use({ serviceWorkers: "allow" });
  // Playwright can only take a service-worker-controlled page offline reliably in Chromium.
  test.skip(({ browserName }) => browserName !== "chromium", "offline emulation with service workers is Chromium-only");

  test("the game loads and plays with no network after the first visit, from a single current cache", async ({ page, context }) => {
    await page.goto("./");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    // an old cache from a previous version is removed when the new worker takes over
    const caches1 = await page.evaluate(() => caches.keys());
    expect(caches1).toHaveLength(1);
    expect(caches1[0]).toMatch(/^mugnut-[0-9a-f]{10}$/);

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("#home")).toBeVisible();
    await page.locator("#dailyBtn").click();
    await expect(page.locator("#pic svg")).toBeVisible();
    expect(await page.evaluate(() => fetch("icons/icon-192.png").then(r => r.ok))).toBe(true);
    expect(await page.evaluate(() => fetch("manifest.webmanifest").then(r => r.ok))).toBe(true);
    await context.setOffline(false);
  });

  test("a missing page is not saved as the offline copy of the game", async ({ page, context }) => {
    await page.goto("./");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await page.goto("./no-such-page", { waitUntil: "load" }).catch(() => {});
    await context.setOffline(true);
    await page.goto("./");
    await expect(page.locator("#home")).toBeVisible();
    await context.setOffline(false);
  });

  test("an update arrives whole: a new page never runs with old scripts, online or offline afterwards", async ({ page, context }) => {
    const errors = [];
    page.on("pageerror", e => errors.push(String(e)));
    await page.goto("./");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await expect(page.locator("#home")).toBeVisible();

    // The site is redeployed: the page now needs something only the new objects.js has. The installed worker is the old one.
    const fs = require("fs"), root = require("path").resolve(__dirname, "..");
    await context.route("**/sw.js", r => r.abort()); // the worker update itself does not get through on this visit
    await context.route("**/objects.js", r => r.fulfill({ contentType: "text/javascript", body: fs.readFileSync(root + "/objects.js", "utf8") + "\nconst FROM_V2 = () => 'v2';\n" }));
    await context.route(url => /\/(index\.html)?$/.test(url.pathname), r => r.fulfill({ contentType: "text/html", body: fs.readFileSync(root + "/index.html", "utf8").replace("</body>", "<script>document.documentElement.dataset.v = FROM_V2();</script></body>") }));
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-v", "v2");
    await expect(page.locator("#levelBtns .lvbtn")).toHaveCount(4);

    // and what is kept for offline use is that same matching pair
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-v", "v2");
    await expect(page.locator("#levelBtns .lvbtn")).toHaveCount(4);
    await page.locator('#packBtns .lvbtn').first().click();
    await expect(page.locator("#pic svg")).toBeVisible();
    await context.setOffline(false);
    expect(errors).toEqual([]);
  });

  test("every pack and both languages work with no network", async ({ page, context }) => {
    await page.goto("./");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("#packBtns .lvbtn")).toHaveCount(5);
    expect(await page.evaluate(() => OBJECTS.length)).toBeGreaterThanOrEqual(257);
    for (const lang of ["hy", "ru"]) {
      await page.locator("#langSel").selectOption(lang);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
    }
    await context.setOffline(false);
  });

  test("caches left by earlier versions are deleted", async ({ page }) => {
    await page.goto("./");
    await page.evaluate(() => caches.open("mugnut-v5").then(c => c.put("old", new Response("old"))));
    await page.evaluate(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); });
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => caches.keys())).toEqual([expect.stringMatching(/^mugnut-[0-9a-f]{10}$/)]);
  });
});
