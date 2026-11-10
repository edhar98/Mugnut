// Service worker: build stamp and offline play.
const { test, expect } = require("@playwright/test");
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

  test("caches left by earlier versions are deleted", async ({ page }) => {
    await page.goto("./");
    await page.evaluate(() => caches.open("mugnut-v5").then(c => c.put("old", new Response("old"))));
    await page.evaluate(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); });
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => caches.keys())).toEqual([expect.stringMatching(/^mugnut-[0-9a-f]{10}$/)]);
  });
});
