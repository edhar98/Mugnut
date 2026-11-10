// Renders the app icon and launch images for the native projects and the stores from one drawing.
// Usage: node tools/make-app-icons.js      (after `npx cap add ios` / `npx cap add android`)
// Writes: ios AppIcon (1024, no transparency), ios splash, android launcher icons (legacy, round, adaptive foreground),
// android splash images at whatever sizes the project already contains, and store/icon-1024.png + store/feature-1024x500.png.
const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");

const ROOT = path.resolve(__dirname, "..");
const NAVY = "#1f2a44", CREAM = "#f6f2e9", BLUE = "#7aa2d6";
// the torus, drawn in a 512 box; `scale` shrinks it around the centre (adaptive icons need a wide safe margin)
const torus = (scale = 1) => `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
  <ellipse cx="256" cy="256" rx="192" ry="119" fill="${BLUE}" stroke="${CREAM}" stroke-width="9"/>
  <path d="M189 249 Q256 263 323 249 Q318 291 256 291 Q194 291 189 249 Z" fill="${NAVY}" stroke="${CREAM}" stroke-width="7" stroke-linejoin="round"/></g>`;
const svg = (inner, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">${bg ? `<rect width="512" height="512" fill="${bg}"/>` : ""}${inner}</svg>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const shot = async (file, w, h, html, transparent = false) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<body style="margin:0;width:${w}px;height:${h}px;overflow:hidden;background:${transparent ? "transparent" : NAVY}">${html}</body>`);
    await page.screenshot({ path: file, omitBackground: transparent });
    console.log(path.relative(ROOT, file));
  };
  const icon = svg(torus(), NAVY);
  const centred = (size, bg) => `<div style="width:100%;height:100%;background:${bg};display:flex;align-items:center;justify-content:center"><div style="width:${size}px;height:${size}px">${svg(torus(), null)}</div></div>`;

  // stores
  await shot(path.join(ROOT, "store/icon-1024.png"), 1024, 1024, icon);
  await shot(path.join(ROOT, "store/feature-1024x500.png"), 1024, 500, `<div style="width:1024px;height:500px;background:${NAVY};display:flex;align-items:center;gap:36px;padding-left:64px;box-sizing:border-box;color:${CREAM};font-family:'Iowan Old Style',Palatino,Georgia,serif">
    <div style="width:300px;height:300px;flex:none">${svg(torus(), null)}</div><div><div style="font-size:112px;font-weight:600;line-height:1">Mugnut</div><div style="font:32px system-ui,sans-serif;margin-top:18px;opacity:.9">How many holes does it have?</div></div></div>`);

  // iOS
  const ios = path.join(ROOT, "ios/App/App/Assets.xcassets");
  if (fs.existsSync(ios)) {
    await shot(path.join(ios, "AppIcon.appiconset/AppIcon-512@2x.png"), 1024, 1024, icon);
    for (const f of fs.readdirSync(path.join(ios, "Splash.imageset")).filter(f => f.endsWith(".png"))) await shot(path.join(ios, "Splash.imageset", f), 2732, 2732, centred(560, NAVY));
  }
  // Android
  const res = path.join(ROOT, "android/app/src/main/res");
  if (fs.existsSync(res)) {
    for (const [dir, px] of [["mdpi", 48], ["hdpi", 72], ["xhdpi", 96], ["xxhdpi", 144], ["xxxhdpi", 192]]) {
      await shot(path.join(res, `mipmap-${dir}/ic_launcher.png`), px, px, `<div style="width:100%;height:100%;border-radius:22%;overflow:hidden">${icon}</div>`, true);
      await shot(path.join(res, `mipmap-${dir}/ic_launcher_round.png`), px, px, `<div style="width:100%;height:100%;border-radius:50%;overflow:hidden">${svg(torus(0.82), NAVY)}</div>`, true);
      await shot(path.join(res, `mipmap-${dir}/ic_launcher_foreground.png`), px * 2.25, px * 2.25, svg(torus(0.56), null), true); // 108dp canvas, art inside the 66dp safe zone
    }
    const png = f => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
    for (const d of fs.readdirSync(res).filter(d => d.startsWith("drawable"))) {
      const f = path.join(res, d, "splash.png"); if (!fs.existsSync(f)) continue;
      const [w, h] = png(f);
      await shot(f, w, h, centred(Math.round(Math.min(w, h) * 0.36), NAVY));
    }
  }
  await browser.close();
})();
