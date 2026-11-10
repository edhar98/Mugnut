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
  const objs = await page.evaluate(([ns, pack, marks]) => OBJECTS.filter(o => (!ns.length || ns.includes(o.name)) && (!pack || o.pack === pack)).map(o => ({ i: OBJECTS.indexOf(o), name: o.name, sub: o.sub || "", svg: o.svg + (marks ? marksSVG(o) : "") })), [names, pack, marks]);
  for (const o of objs) {
    await page.setContent(`<body style="margin:0;background:#fbf7ee"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" width="480" height="400">${o.svg}</svg></body>`);
    const file = path.join(outDir, String(o.i).padStart(3, "0") + "-" + (o.name + (o.sub ? "-" + o.sub : "")).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".png");
    await page.screenshot({ path: file });
    console.log(file);
  }
  // the same checks the test suite makes, so problems show up while drawing
  await page.goto("file://" + path.resolve(__dirname, "..", "index.html"));
  const problems = await page.evaluate(([ns, pack]) => OBJECTS.filter(o => (!ns.length || ns.includes(o.name)) && (!pack || o.pack === pack)).flatMap(o => {
    const out = [], doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${o.svg}</svg>`, "image/svg+xml");
    if (doc.querySelector("parsererror")) out.push("svg is not well-formed XML");
    if (/NaN|undefined/.test(o.svg)) out.push("svg contains NaN/undefined");
    if (o.pack && /<text/i.test(o.svg)) out.push("pack drawings must not use <text>");
    if (o.holes !== undefined || o.open !== undefined) {
      const total = (o.holes || []).length + Math.max(0, (o.open || []).length - 1);
      if (o.g < 5 ? total !== o.g : total < 5) out.push(`marks show ${total} holes but g is ${o.g}`);
    } else if (o.pack) out.push("no hole marks (holes / open)");
    if (o.name.length > 28) out.push("name over 28 characters");
    if ((o.sub || "").length > 40) out.push("sub over 40 characters");
    if (!o.ex || o.ex.length > 140) out.push("ex missing or over 140 characters");
    return out.map(m => `PROBLEM ${o.name}${o.sub ? " [" + o.sub + "]" : ""}: ${m}`);
  }), [names, pack]);
  problems.forEach(m => console.log(m));
  await browser.close();
  if (!objs.length) { console.error("no matching objects"); process.exit(1); }
})();
