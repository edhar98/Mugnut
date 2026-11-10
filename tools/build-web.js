// Copies the web game into dist/, which is what the native apps (Capacitor) package.
// The web version itself needs no build: GitHub Pages serves the repository root as it is.
//   node tools/build-web.js                 for store builds
//   node tools/build-web.js --mock-store    development builds: purchases are simulated, no store account needed
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const outArg = process.argv.find(a => a.startsWith("--out="));   // tests build somewhere else
const DIST = outArg ? path.resolve(outArg.slice(6)) : path.join(ROOT, "dist");
// Everything the page loads. The service worker is left out on purpose: the apps carry their files with them.
const FILES = ["index.html", "objects.js", "native.js", "manifest.webmanifest"];
const DIRS = ["packs", "lang", "icons"];

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
for (const f of FILES) fs.copyFileSync(path.join(ROOT, f), path.join(DIST, f));
for (const d of DIRS) fs.cpSync(path.join(ROOT, d), path.join(DIST, d), { recursive: true });

// Capacitor's core script (plain, no modules): it gives native.js the plugin objects. Only the apps load it.
const MARKER = '<script src="native.js"></script>';
fs.copyFileSync(path.join(ROOT, "node_modules/@capacitor/core/dist/capacitor.js"), path.join(DIST, "capacitor.js"));
let html = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
if (!html.includes(MARKER)) { console.error("cannot find the native.js script tag in index.html"); process.exit(1); }
html = html.replace(MARKER, '<script src="capacitor.js"></script>\n' + MARKER);
fs.writeFileSync(path.join(DIST, "index.html"), html);

// every script the page asks for must have been copied
const missing = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(src => !fs.existsSync(path.join(DIST, src)));
if (missing.length) { console.error("dist is missing scripts the page loads: " + missing.join(", ")); process.exit(1); }

if (process.argv.includes("--mock-store")) {
  fs.writeFileSync(path.join(DIST, "index.html"), html.replace(MARKER, "<script>window.MUGNUT_MOCK_STORE = true;</script>\n" + MARKER));
  console.log("built " + path.relative(ROOT, DIST) + "/ with the MOCK store: do not submit this build");
} else console.log("built " + path.relative(ROOT, DIST) + "/");
