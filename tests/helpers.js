// Shared helpers for the Mugnut smoke suite.
const base = require("@playwright/test");
const { expect } = base;

/**
 * Every context in the suite: analytics hits are captured in window.__hits instead of being sent
 * (so runs against the live site never reach the real counter), and anything that still tries is aborted.
 */
async function quiet(context) {
  await context.route(/goatcounter\.com|gc\.zgo\.at/, r => r.abort());
  await context.addInitScript(() => {
    window.__hits = [];
    try { Object.defineProperty(navigator, "sendBeacon", { value: u => { window.__hits.push(String(u)); return true; }, configurable: true }); } catch (e) {}
  });
}
const test = base.test.extend({
  context: async ({ context }, use) => { await quiet(context); await use(context); },
});

// Top-level `const`/`let` in the game's classic script (OBJECTS, G, store, shareCtx…)
// are reachable by name from page.evaluate, though not as window properties.

/** Fail the test on any uncaught page error or console.error. */
function watchErrors(page) {
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  return errors;
}

/** Make sharing deterministic: no native share sheet, clipboard writes are captured. */
async function stubSharing(context) {
  await context.addInitScript(() => {
    window.__copied = [];
    try { Object.defineProperty(navigator, "share", { value: undefined, configurable: true }); } catch (e) {}
    const fake = { writeText: t => { window.__copied.push(String(t)); return Promise.resolve(); } };
    try { Object.defineProperty(navigator, "clipboard", { value: fake, configurable: true }); } catch (e) {}
  });
}
const lastCopied = page => page.evaluate(() => window.__copied[window.__copied.length - 1]);

/** A second, storage-isolated "phone" with the same device settings as the project. */
async function newPhone(browser, testInfo) {
  const u = testInfo.project.use;
  const context = await browser.newContext({
    baseURL: u.baseURL, viewport: u.viewport, userAgent: u.userAgent,
    deviceScaleFactor: u.deviceScaleFactor, isMobile: u.isMobile, hasTouch: u.hasTouch,
    timezoneId: u.timezoneId, locale: u.locale, serviceWorkers: "block",
  });
  await quiet(context);
  await stubSharing(context);
  return context;
}

const currentAnswer = page => page.evaluate(() => G.deck[G.idx].g);

/** Answer the question on screen, correctly or not; returns the option picked. */
async function answerCurrent(page, correct) {
  const g = await currentAnswer(page);
  const pick = correct ? g : (g + 1) % 6;
  await page.locator(`#opts .opt[data-g="${pick}"]`).click();
  await expect(page.locator("#fb")).toHaveClass(new RegExp(correct ? "good" : "bad"));
  return pick;
}

module.exports = { test, expect, quiet, watchErrors, stubSharing, lastCopied, newPhone, currentAnswer, answerCurrent };
