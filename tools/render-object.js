// Render one or more OBJECTS drawings to PNG so art can be looked at, not assumed.
// Usage: node tools/render-object.js <out-dir> [--marks] [--pack=<id>] ["Object name" …]   (no names = all objects)
// Reads index.html straight from disk: no server needed.
const path = require("path");
const fs = require("fs");
const { chromium } = require("@playwright/test");

(async () => {
  // --marks draws the hole rings on top, as the game does after an answer; --pack=<id> renders one pack
  const flags = process.argv.slice(2).filter(a => a.startsWith("--"));
  const [outDir, ...names] = process.argv.slice(2).filter(a => !a.startsWith("--"));
  const marks = flags.includes("--marks"), pack = (flags.find(f => f.startsWith("--pack=")) || "").slice(7);
  if (!outDir) { console.error("usage: node tools/render-object.js <out-dir> [names…]"); process.exit(2); }
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 480, height: 400 }, deviceScaleFactor: 2 });
  await page.goto("file://" + path.resolve(__dirname, "..", "index.html"));
  const objs = await page.evaluate(([ns, pack, marks]) => OBJECTS.filter(o => (!ns.length || ns.includes(o.name)) && (!pack || o.pack === pack)).map(o => ({ name: o.name, sub: o.sub || "", svg: o.svg + (marks ? marksSVG(o) : "") })), [names, pack, marks]);
  for (const o of objs) {
    await page.setContent(`<body style="margin:0;background:#fbf7ee"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" width="480" height="400">${o.svg}</svg></body>`);
    const file = path.join(outDir, (o.name + (o.sub ? "-" + o.sub : "")).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".png");
    await page.screenshot({ path: file });
    console.log(file);
  }
  await browser.close();
  if (!objs.length) { console.error("no matching objects"); process.exit(1); }
})();
