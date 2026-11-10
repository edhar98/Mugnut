// Regenerates tests/fixtures/photo.jpg: a photo-like fixture drawn from the game's own art.
// Usage: node tests/fixtures/make-photo.js   (needs the dev server: npm run serve)
const path = require("path");
const { chromium } = require("@playwright/test");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.goto(process.env.MUGNUT_URL || "http://127.0.0.1:4173/");
  const svg = await page.evaluate(() => mug());
  await page.setContent(`<body style="margin:0;background:linear-gradient(135deg,#d9c7a3,#8a9a7b)">
    <svg viewBox="0 0 240 200" width="1200" height="900" style="filter:drop-shadow(8px 12px 10px rgba(0,0,0,.35))">${svg}</svg></body>`);
  await page.screenshot({ path: path.join(__dirname, "photo.jpg"), type: "jpeg", quality: 85 });
  await browser.close();
})();
