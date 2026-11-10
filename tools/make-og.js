// Renders og.png (1200×630), the picture shown when a link to the game is shared, from the game's own drawings.
// Usage: node tools/make-og.js     Re-run after changing the mug or donut art, then commit og.png.
const path = require("path");
const { chromium } = require("@playwright/test");

(async () => {
  const root = path.resolve(__dirname, "..");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto("file://" + path.join(root, "index.html"));
  const art = await page.evaluate(() => ({ mug: mug(), donut: donut(), pretzel: pretzel(), g0: genusIcon(0, 160, 88), g1: genusIcon(1, 160, 88), g2: genusIcon(2, 160, 88) }));
  const svg = (inner, w) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" width="${w}" height="${w / 1.2}">${inner}</svg>`;
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    body{margin:0;width:1200px;height:630px;background:#f6f2e9;color:#1f2a44;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow:hidden}
    .serif{font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;font-weight:600}
    .left{position:absolute;left:72px;top:92px;width:520px}
    h1{font-size:128px;letter-spacing:-.02em;margin:0;line-height:1}
    .tag{font-size:40px;line-height:1.25;margin:26px 0 0;color:#1f2a44}
    .sub{font-size:27px;color:#6b7280;margin:22px 0 0;line-height:1.35}
    .card{position:absolute;right:64px;top:70px;width:500px;height:490px;background:#fffdf8;border:2px solid #e3dccd;border-radius:36px}
    .mug{position:absolute;left:14px;top:26px}.donut{position:absolute;right:14px;top:26px}
    .eq{position:absolute;left:0;right:0;top:92px;text-align:center;font-size:76px;color:#3d5a98}
    .q{position:absolute;left:0;right:0;top:268px;text-align:center;font-size:27px;font-weight:500}
    .opts{position:absolute;left:28px;right:28px;bottom:30px;display:flex;justify-content:space-between}
    .opt{width:136px;height:132px;border:2px solid #e3dccd;border-radius:18px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:20px;font-weight:600;gap:6px}
    .opt.on{border-color:#2f8f5b;background:#e6f4ec}
    .opt svg{width:104px;height:57px}
  </style>
  <div class="left"><h1 class="serif">Mugnut</h1>
    <p class="tag serif">To a topologist, a coffee mug and a donut are the same thing.</p>
    <p class="sub">A game about the holes in everyday objects.</p></div>
  <div class="card">
    <div class="mug">${svg(art.mug, 228)}</div><div class="eq serif">=</div><div class="donut">${svg(art.donut, 228)}</div>
    <div class="q">What is it, topologically?</div>
    <div class="opts"><div class="opt">${art.g0}Sphere</div><div class="opt on">${art.g1}Torus</div><div class="opt">${art.g2}Double torus</div></div>
  </div>`);
  await page.screenshot({ path: path.join(root, "og.png"), type: "png" });
  await browser.close();
  console.log("wrote og.png");
})();
