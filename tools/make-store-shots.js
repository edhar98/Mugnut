// Store screenshots at the sizes the App Store and Google Play ask for, in English, Armenian and Russian.
// They are taken from the real game code running in a browser at each device's size, inside a stand-in for the app
// shell with everything unlocked. Retake them on real devices or simulators if the stores' sizes change.
// Usage: node tools/make-store-shots.js [lang ...]      -> store/screens/<device>/<lang>-<n>-<name>.png
const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");

const ROOT = path.resolve(__dirname, "..");
const DEVICES = {
  "ios-6.9in-1320x2868":    { width: 440,  height: 956,  scale: 3 },   // iPhone 6.9" (required)
  "ios-ipad-13in-2064x2752": { width: 1032, height: 1376, scale: 2 },  // iPad 13" (required if the app runs on iPad)
  "android-phone-1080x1920": { width: 360,  height: 640,  scale: 3 },  // Google Play phone
};
const langs = process.argv.slice(2).length ? process.argv.slice(2) : ["en", "hy", "ru"];

(async () => {
  const browser = await chromium.launch();
  for (const [device, d] of Object.entries(DEVICES)) for (const lang of langs) {
    const ctx = await browser.newContext({ viewport: { width: d.width, height: d.height }, deviceScaleFactor: d.scale, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
    await ctx.addInitScript(l => {
      try { localStorage.setItem("mugnut:lang", JSON.stringify(l)); localStorage.setItem("mugnut:unlock", "1"); } catch (e) {}
      const ok = async () => ({}), LocalNotifications = { requestPermissions: async () => ({ display: "granted" }), schedule: ok, cancel: ok };
      window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios", Plugins: { LocalNotifications, Haptics: { notification: ok }, App: { addListener: ok, getLaunchUrl: ok } } };
    }, lang);
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(2026, 10, 21, 9, 41));
    await page.goto("file://" + path.join(ROOT, "index.html"));
    await page.waitForFunction(l => document.documentElement.lang === l && !document.getElementById("home").classList.contains("hidden"), lang);
    const dir = path.join(ROOT, "store/screens", device); fs.mkdirSync(dir, { recursive: true });
    let n = 0;
    const shot = async name => { await page.waitForTimeout(150); await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: path.join(dir, `${lang}-${++n}-${name}.png`) }); };
    const ask = (name, sub) => page.evaluate(([name, sub]) => { const o = OBJECTS.find(o => o.name === name && (sub === undefined || (o.sub || "") === sub)); G = { mode: "level", lv: o.lv, deck: [o, o, o, o, o, o, o, o, o, o], idx: 2, score: 2, lives: null, missed: [], lastLv: o.lv }; show("game"); renderQ(); return o.g; }, [name, sub]);

    await shot("menu");
    await ask("Coffee mug");
    await shot("question");
    const g = await ask("T-shirt", "");
    await page.locator(`#opts .opt[data-g="${g}"]`).click();
    await shot("where-the-holes-are");
    const g2 = await ask("Armenian letter Փ");
    await page.locator(`#opts .opt[data-g="${g2}"]`).click();
    await shot("letters-pack");
    const g3 = await ask("Person", "mouth, two nostrils, one exit");
    await page.locator(`#opts .opt[data-g="${(g3 + 3) % 6}"]`).click();
    await shot("controversies");
    await page.evaluate(() => { renderHome(); openArchive(); });
    await shot("past-objects");
    await ctx.close();
    console.log(device, lang, n);
  }
  await browser.close();
})();
