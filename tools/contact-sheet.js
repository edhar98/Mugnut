// One PNG showing every object of a pack (or the core set) with its name, answer and hole rings: for reviewing art at a glance.
// Usage: node tools/contact-sheet.js <out.png> [--pack=<id> | --core] [--plain] [--from=<n>] [--count=<n>]
const path = require("path");
const { chromium } = require("@playwright/test");

(async () => {
  const flags = process.argv.slice(2).filter(a => a.startsWith("--"));
  const out = process.argv.slice(2).find(a => !a.startsWith("--"));
  if (!out) { console.error("usage: node tools/contact-sheet.js <out.png> [--pack=<id> | --core] [--plain] [--from=<n>] [--count=<n>]"); process.exit(2); }
  const get = k => (flags.find(f => f.startsWith(`--${k}=`)) || "").slice(k.length + 3);
  const pack = get("pack"), core = flags.includes("--core"), plain = flags.includes("--plain");
  const from = +get("from") || 0, count = +get("count") || 1000;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  await page.goto("file://" + path.resolve(__dirname, "..", "index.html"));
  const n = await page.evaluate(([pack, core, plain, from, count]) => {
    const list = OBJECTS.filter(o => core ? !o.pack : pack ? o.pack === pack : true).slice(from, from + count);
    document.body.innerHTML = `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:8px;background:#f6f2e9;width:1184px;font:13px system-ui">` + list.map(o =>
      `<div style="background:#fffdf8;border:1px solid #e3dccd;border-radius:10px;padding:6px;text-align:center">
        <svg viewBox="0 0 240 200" style="width:100%;background:#fbf7ee;border-radius:8px">${o.svg}${plain ? "" : marksSVG(o)}</svg>
        <b>${o.name}</b> · g${o.g === 5 ? "5+" : o.g} · L${o.lv}<br><span style="color:#6b7280">${o.sub || "&nbsp;"}</span></div>`).join("") + `</div>`;
    return list.length;
  }, [pack, core, plain, from, count]);
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
  console.log(`${n} objects -> ${out}`);
})();
