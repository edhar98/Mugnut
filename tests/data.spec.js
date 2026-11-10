// OBJECTS data integrity: runs against the real page so it checks what ships.
const { test, expect } = require("./helpers");

test("OBJECTS has valid levels, genus values, unique names and drawable art", async ({ page }) => {
  await page.goto("./");
  const report = await page.evaluate(() => {
    const problems = [];
    const perLevel = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const seen = new Map();
    OBJECTS.forEach((o, i) => {
      const where = `#${i} "${o && o.name}"`;
      if (![1, 2, 3, 4].includes(o.lv)) problems.push(`${where}: bad level ${o.lv}`); else perLevel[o.lv]++;
      if (!Number.isInteger(o.g) || o.g < 0 || o.g > 5) problems.push(`${where}: bad genus ${o.g}`);
      if (typeof o.name !== "string" || !o.name.trim()) problems.push(`${where}: missing name`);
      if (typeof o.ex !== "string" || o.ex.trim().length < 10) problems.push(`${where}: missing explanation`);
      if (o.sub != null && typeof o.sub !== "string") problems.push(`${where}: bad sub`);
      const key = `${o.name}|${o.sub || ""}`.toLowerCase();
      if (seen.has(key)) problems.push(`${where}: duplicate of #${seen.get(key)}`); else seen.set(key, i);
      if (typeof o.svg !== "string" || !o.svg.trim()) problems.push(`${where}: missing svg`);
      else {
        const doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200">${o.svg}</svg>`, "image/svg+xml");
        if (doc.querySelector("parsererror")) problems.push(`${where}: svg does not parse`);
        else if (!doc.documentElement.children.length) problems.push(`${where}: svg is empty`);
        if (/NaN|undefined/.test(o.svg)) problems.push(`${where}: svg contains NaN/undefined`);
        if (/<script|<image|href=|\son\w+=/i.test(o.svg)) problems.push(`${where}: svg has script, image or link`);
      }
    });
    return { count: OBJECTS.length, perLevel, problems, names: new Set(OBJECTS.map(o => o.name)).size };
  });
  expect(report.problems).toEqual([]);
  expect(report.count).toBe(100);
  expect(report.perLevel).toEqual({ 1: 25, 2: 25, 3: 25, 4: 25 });
});

test("every level offers each answer the round can ask about, and every genus label exists", async ({ page }) => {
  await page.goto("./");
  const r = await page.evaluate(() => ({
    shapes: SHAPES.length, subs: SHAPE_SUB.length,
    maxG: Math.max(...OBJECTS.map(o => o.g)),
    daily: (() => { const o = dailyObject(); return !!o && OBJECTS.includes(o); })(),
  }));
  expect(r.shapes).toBe(6);
  expect(r.subs).toBe(6);
  expect(r.maxG).toBeLessThanOrEqual(5);
  expect(r.daily).toBe(true);
});

test("the daily object is defined every day, with no repeats within a cycle, even before day 1", async ({ page }) => {
  await page.goto("./");
  const n = await page.evaluate(() => OBJECTS.length);
  const seen = new Set();
  // Calls the real dailyObject() under a moved clock. Noon UTC is the same calendar day in the pinned zone.
  for (let day = -5; day <= n; day++) {
    await page.clock.setFixedTime(new Date(Date.UTC(2026, 10, 10 + day - 1, 12)));
    const r = await page.evaluate(() => { const o = dailyObject(); return { num: dailyNum(), key: o && OBJECTS.includes(o) ? o.name + "|" + (o.sub || "") : null }; });
    expect(r.num).toBe(day);
    expect(r.key, `day ${day}`).not.toBeNull();
    if (day >= 1) seen.add(r.key);
  }
  expect(seen.size).toBe(n);
});
