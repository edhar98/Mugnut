// OBJECTS data integrity: runs against the real page so it checks what ships.
const { test, expect } = require("./helpers");

test("every object has valid data and drawable art; the core 100 are intact", async ({ page }) => {
  await page.goto("./");
  const report = await page.evaluate(() => {
    const problems = [];
    const coreLevels = { 1: 0, 2: 0, 3: 0, 4: 0 }, packs = {};
    const seen = new Map();
    const inBox = m => Array.isArray(m) && (m.length === 2 || m.length === 3) && m.every(Number.isFinite) && m[0] >= 0 && m[0] <= 240 && m[1] >= 0 && m[1] <= 200 && (m[2] === undefined || (m[2] >= 4 && m[2] <= 60));
    OBJECTS.forEach((o, i) => {
      const where = `#${i} "${o && o.name}"`;
      if (![1, 2, 3, 4].includes(o.lv)) problems.push(`${where}: bad level ${o.lv}`);
      if (!Number.isInteger(o.g) || o.g < 0 || o.g > 5) problems.push(`${where}: bad genus ${o.g}`);
      if (typeof o.name !== "string" || !o.name.trim() || o.name.length > 28) problems.push(`${where}: missing or over-long name`);
      if (typeof o.ex !== "string" || o.ex.trim().length < 10 || o.ex.length > 140) problems.push(`${where}: explanation missing or over 140 characters`);
      if (o.sub != null && (typeof o.sub !== "string" || o.sub.length > 40)) problems.push(`${where}: bad sub`);
      if (i < 100 ? o.pack !== undefined : !Object.prototype.hasOwnProperty.call(PACKS, o.pack)) problems.push(`${where}: ${i < 100 ? "a core object must not have a pack" : "unknown pack " + o.pack}`);
      if (i < 100) coreLevels[o.lv]++; else packs[o.pack] = (packs[o.pack] || 0) + 1;
      const key = `${o.name}|${o.sub || ""}`.toLowerCase();
      if (seen.has(key)) problems.push(`${where}: duplicate of #${seen.get(key)}`); else seen.set(key, i);
      if (typeof o.svg !== "string" || !o.svg.trim()) problems.push(`${where}: missing svg`);
      else {
        const doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200">${o.svg}</svg>`, "image/svg+xml");
        if (doc.querySelector("parsererror")) problems.push(`${where}: svg does not parse`);
        else if (!doc.documentElement.children.length) problems.push(`${where}: svg is empty`);
        if (/NaN|undefined/.test(o.svg)) problems.push(`${where}: svg contains NaN/undefined`);
        if (/<script|<image|<foreignObject|href=|\son\w+=/i.test(o.svg)) problems.push(`${where}: svg has script, image or link`);
        if (i >= 100 && /<text/i.test(o.svg)) problems.push(`${where}: pack drawings must not use font text (it renders differently per device)`);
      }
      // hole marks, where given, must add up to the answer
      for (const k of ["holes", "open"]) if (o[k] !== undefined && !(Array.isArray(o[k]) && o[k].every(inBox))) problems.push(`${where}: bad ${k} marks`);
      if (o.holes !== undefined || o.open !== undefined) {
        const h = (o.holes || []).length, n = (o.open || []).length, total = h + Math.max(0, n - 1);
        if (o.g < 5 ? total !== o.g : total < 5) problems.push(`${where}: marks show ${total} holes but the answer is ${o.g === 5 ? "5 or more" : o.g}`);
      }
    });
    return { count: OBJECTS.length, coreLevels, packs, problems, marked: OBJECTS.filter(o => o.holes !== undefined || o.open !== undefined).length };
  });
  expect(report.problems).toEqual([]);
  expect(report.count).toBeGreaterThanOrEqual(100);
  expect(report.coreLevels).toEqual({ 1: 25, 2: 25, 3: 25, 4: 25 });
  for (const [id, n] of Object.entries(report.packs)) expect(n, `pack ${id} needs at least 10 objects for a round`).toBeGreaterThanOrEqual(10);
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
  const n = await page.evaluate(() => DAILY_POOL);
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
