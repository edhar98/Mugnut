// Writes the build stamp into sw.js so the offline cache is renewed whenever a shipped file changes.
// The stamp is a hash of every file the service worker caches, plus sw.js itself.
//   node tools/stamp.js           update sw.js if needed
//   node tools/stamp.js --check   exit 1 if sw.js is out of date (used by the tests)
// The pre-commit hook in .githooks/ runs this automatically: git config core.hooksPath .githooks
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const SW = path.join(ROOT, "sw.js");
const LINE = /const BUILD = "([^"]*)";/;

function compute() {
  const sw = fs.readFileSync(SW, "utf8");
  if (!LINE.test(sw)) throw new Error("sw.js has no BUILD line");
  const files = JSON.parse(sw.match(/const FILES = (\[[\s\S]*?\]);/)[1]).filter(f => f !== "./");
  const h = crypto.createHash("sha256");
  h.update(sw.replace(LINE, 'const BUILD = "";'));
  for (const f of files.sort()) { h.update("\0" + f + "\0"); h.update(fs.readFileSync(path.join(ROOT, f))); }
  return { sw, current: sw.match(LINE)[1], wanted: h.digest("hex").slice(0, 10) };
}

if (require.main === module) {
  const { sw, current, wanted } = compute();
  if (current === wanted) { console.log("build stamp up to date: " + wanted); process.exit(0); }
  if (process.argv.includes("--check")) { console.error(`sw.js build stamp is stale (${current || "empty"}, should be ${wanted}). Run: npm run stamp`); process.exit(1); }
  fs.writeFileSync(SW, sw.replace(LINE, `const BUILD = "${wanted}";`));
  console.log("build stamp updated: " + wanted);
}
module.exports = { compute };
