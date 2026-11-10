// Daily mode: one object per calendar day, locked after answering, with a day streak.
const { test, expect, watchErrors, stubSharing, lastCopied, answerCurrent } = require("./helpers");

// Wall-clock time in the browser's pinned zone (Asia/Yerevan, UTC+4, no DST), whatever zone the test runner is in.
const at = (y, m, d, h = 10, min = 0, sec = 0) => new Date(Date.UTC(y, m - 1, d, h - 4, min, sec));
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem("mugnut:daily")));

test.beforeEach(async ({ context }) => { await stubSharing(context); });

test("play today's object, then it is locked for the rest of the day", async ({ page }) => {
  const errors = watchErrors(page);
  await page.clock.setFixedTime(at(2026, 11, 12));
  await page.goto("./");
  await expect(page.locator("#dTag")).toHaveText("#3"); // day 1 is 10 Nov 2026

  await page.locator("#dailyBtn").click();
  await expect(page.locator("#game")).toBeVisible();
  await expect(page.locator("#tot")).toHaveText("1");
  const name = await page.locator("#name").textContent();
  const picked = await answerCurrent(page, true);
  await expect(page.locator("#nextBtn")).toHaveText("See results");
  await page.locator("#nextBtn").click();

  await expect(page.locator("#endTitle")).toHaveText("Today's object #3");
  await expect(page.locator("#final")).toHaveText("✓");
  await expect(page.locator("#verdict")).toContainText("Day streak: 1");
  expect(await stored(page)).toEqual({ day: "2026-11-12", num: 3, g: picked, ok: true, streak: 1 });

  await page.locator("#homeBtn").click();
  await expect(page.locator("#dTag")).toHaveText("✓ Done · streak 1");

  // Locked: reopening shows the same object already answered, and nothing can be changed.
  await page.clock.setFixedTime(at(2026, 11, 12, 23));
  await page.locator("#dailyBtn").click();
  await expect(page.locator("#name")).toHaveText(name);
  await expect(page.locator("#opts .opt:disabled")).toHaveCount(6);
  await expect(page.locator(`#opts .opt[data-g="${picked}"]`)).toHaveClass(/correct/);
  await expect(page.locator("#fb")).toBeVisible();
  await page.locator(`#opts .opt[data-g="${(picked + 1) % 6}"]`).click({ force: true }).catch(() => {});
  expect(await stored(page)).toEqual({ day: "2026-11-12", num: 3, g: picked, ok: true, streak: 1 });

  // Still locked after a reload.
  await page.reload();
  await expect(page.locator("#dTag")).toHaveText("✓ Done · streak 1");
  expect(errors).toEqual([]);
});

test("streak grows on consecutive days and resets after a missed day", async ({ page }) => {
  await page.clock.setFixedTime(at(2026, 11, 12));
  await page.goto("./");
  const playToday = async correct => {
    await page.locator("#dailyBtn").click();
    const name = await page.locator("#name").textContent();
    await answerCurrent(page, correct);
    await page.locator("#nextBtn").click();
    await expect(page.locator("#end")).toBeVisible();
    return name;
  };

  const first = await playToday(true);
  expect((await stored(page)).streak).toBe(1);

  // Next day: a new object, a wrong answer still keeps the streak of days played.
  await page.clock.setFixedTime(at(2026, 11, 13));
  await page.locator("#homeBtn").click();
  await expect(page.locator("#dTag")).toHaveText("#4");
  const second = await playToday(false);
  expect(second).not.toBe(first);
  await expect(page.locator("#final")).toHaveText("✗");
  await expect(page.locator("#verdict")).toContainText("Day streak: 2");
  expect(await stored(page)).toMatchObject({ day: "2026-11-13", ok: false, streak: 2 });
  await page.locator("#homeBtn").click();
  await expect(page.locator("#dTag")).toHaveText("✗ Done · streak 2");

  // Skip the 14th: the streak starts again.
  await page.clock.setFixedTime(at(2026, 11, 15));
  await page.reload();
  await expect(page.locator("#dTag")).toHaveText("#6");
  await playToday(true);
  expect(await stored(page)).toMatchObject({ day: "2026-11-15", ok: true, streak: 1 });
});

test("everyone gets the same object on the same day", async ({ page, browser }, testInfo) => {
  const { newPhone } = require("./helpers");
  await page.clock.setFixedTime(at(2026, 12, 1, 8));
  await page.goto("./");
  await page.locator("#dailyBtn").click();
  const mine = await page.locator("#name").textContent();

  const other = await newPhone(browser, testInfo);
  const p2 = await other.newPage();
  await p2.clock.setFixedTime(at(2026, 12, 1, 22));
  await p2.goto("./");
  await p2.locator("#dailyBtn").click();
  await expect(p2.locator("#name")).toHaveText(mine);
  await other.close();
});

test("sharing the daily result never reveals the answer", async ({ page }) => {
  await page.clock.setFixedTime(at(2026, 11, 12));
  await page.goto("./");
  await page.locator("#dailyBtn").click();
  const o = await page.evaluate(() => { const o = G.deck[0]; return { name: o.name, shape: SHAPES[o.g] }; });
  await answerCurrent(page, true);
  await page.locator("#nextBtn").click();
  await expect(page.locator("#againBtn")).toHaveText("Share result");
  await page.locator("#againBtn").click();
  await expect(page.locator("#verdict")).toHaveText("Result copied — paste it into any chat.");
  const text = await lastCopied(page);
  expect(text).toContain("Mugnut #3");
  expect(text).toContain("✅");
  expect(text).toContain(new URL("./", page.url()).href);
  expect(text.toLowerCase()).not.toContain(o.name.toLowerCase());
  expect(text.toLowerCase()).not.toContain(o.shape.toLowerCase());
  expect(text.toLowerCase()).not.toContain("genus");
});

test("an object opened before midnight and answered after it still counts for the day it was shown", async ({ page }) => {
  await page.clock.setFixedTime(at(2026, 11, 12, 23, 59));
  await page.goto("./");
  await page.locator("#dailyBtn").click();
  const shown = await page.locator("#name").textContent();
  await page.clock.setFixedTime(at(2026, 11, 13, 0, 1));
  await answerCurrent(page, true);
  await page.locator("#nextBtn").click();
  await expect(page.locator("#endTitle")).toHaveText("Today's object #3");
  expect(await stored(page)).toMatchObject({ day: "2026-11-12", num: 3, streak: 1 });
  await page.locator("#againBtn").click();
  expect(await lastCopied(page)).toContain("Mugnut #3");

  // the 13th has its own, still unplayed object, and playing it continues the streak
  await page.locator("#homeBtn").click();
  await expect(page.locator("#dTag")).toHaveText("#4");
  await page.locator("#dailyBtn").click();
  await expect(page.locator("#name")).not.toHaveText(shown);
  await expect(page.locator("#opts .opt:disabled")).toHaveCount(0);
  await answerCurrent(page, true);
  expect(await stored(page)).toMatchObject({ day: "2026-11-13", num: 4, streak: 2 });
});

test("share result falls back to showing the text when nothing can copy or share", async ({ page }) => {
  await page.addInitScript(() => { try { Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true }); } catch (e) {} });
  await page.clock.setFixedTime(at(2026, 11, 12));
  await page.goto("./");
  await page.locator("#dailyBtn").click();
  await answerCurrent(page, false);
  await page.locator("#nextBtn").click();
  await page.locator("#againBtn").click();
  await expect(page.locator("#verdict")).toContainText("Copy this: Mugnut #3");
});

test.describe("where the clocks change", () => {
  test.use({ timezoneId: "Europe/Berlin" });
  // Berlin wall-clock instants: CET is UTC+1, CEST is UTC+2.
  const berlin = (y, m, d, h, min, offset) => new Date(Date.UTC(y, m - 1, d, h - offset, min, 0));
  const play = async page => {
    await page.locator("#dailyBtn").click();
    await answerCurrent(page, true);
    await page.locator("#nextBtn").click();
    await expect(page.locator("#end")).toBeVisible();
    await page.locator("#homeBtn").click();
  };

  test("the streak survives the 23-hour day in spring", async ({ page }) => {
    await page.clock.setFixedTime(berlin(2027, 3, 28, 12, 0, 2)); // clocks went forward at 02:00 this morning
    await page.goto("./");
    const n = Number((await page.locator("#dTag").textContent()).slice(1));
    await play(page);
    await page.clock.setFixedTime(berlin(2027, 3, 29, 0, 30, 2));
    await page.reload();
    await expect(page.locator("#dTag")).toHaveText("#" + (n + 1));
    await play(page);
    expect(await stored(page)).toMatchObject({ day: "2027-03-29", num: n + 1, streak: 2 });
  });

  test("the streak survives the 25-hour day in autumn", async ({ page }) => {
    await page.clock.setFixedTime(berlin(2027, 10, 30, 12, 0, 2));
    await page.goto("./");
    const n = Number((await page.locator("#dTag").textContent()).slice(1));
    await play(page);
    await page.clock.setFixedTime(berlin(2027, 10, 31, 23, 30, 1)); // clocks went back at 03:00 this morning
    await page.reload();
    await expect(page.locator("#dTag")).toHaveText("#" + (n + 1));
    await play(page);
    expect(await stored(page)).toMatchObject({ day: "2027-10-31", num: n + 1, streak: 2 });
  });
});

test.describe("archive and countdown", () => {
  const log = page => page.evaluate(() => JSON.parse(localStorage.getItem("mugnut:daily-log")));

  test("which object belongs to which day never changes", async ({ page }) => {
    // Pinned on purpose: if this fails, players' past answers no longer match their days. Add objects at the end of OBJECTS only.
    await page.goto("./");
    const got = await page.evaluate(() => [1, 2, 3, 4, 5, 6, 7, 100, 101, 365].map(n => [n, dailyObject(n).name]));
    expect(got).toEqual([[1, "Letter A"], [2, "T-shirt"], [3, "Closed book"], [4, "Vase"], [5, "Möbius strip"], [6, "Fork"], [7, "Jigsaw piece"], [100, "Rubber band"], [101, "Letter A"], [365, "Brick"]]);
    // appending objects must not move the rotation
    const same = await page.evaluate(() => { const before = dailyObject(42).name; OBJECTS.push({ ...OBJECTS[0], name: "Extra" }); return before === dailyObject(42).name; });
    expect(same).toBe(true);
  });

  test("on day 1 there is no archive link; later it lists every earlier day, newest first", async ({ page }) => {
    await page.clock.setFixedTime(at(2026, 11, 10));
    await page.goto("./");
    await expect(page.locator("#dTag")).toHaveText("#1");
    await expect(page.locator("#archiveRow")).toBeHidden();

    await page.clock.setFixedTime(at(2026, 11, 14));
    await page.reload();
    await expect(page.locator("#archiveBtn")).toBeVisible();
    await page.locator("#archiveBtn").click();
    await expect(page.locator("#archive")).toBeVisible();
    await expect(page.locator("#arList .arrow b")).toHaveText(["#4 · Nov 13", "#3 · Nov 12", "#2 · Nov 11", "#1 · Nov 10"]);
    await expect(page.locator("#arList .arrow small")).toHaveText(Array(4).fill("Not played yet")); // names would give the objects away
    await expect(page.locator("#arSummary")).toContainText("0 of 4 played");
  });

  test("a past object can be played once; it is recorded but never touches today or the streak", async ({ page }) => {
    const errors = watchErrors(page);
    await page.clock.setFixedTime(at(2026, 11, 13));
    await page.goto("./");
    // play today (#4) first: streak 1
    await page.locator("#dailyBtn").click();
    await answerCurrent(page, true);
    await page.locator("#nextBtn").click();
    await page.locator("#homeBtn").click();
    const today = await stored(page);

    await page.locator("#archiveBtn").click();
    await page.locator('#arList .arrow[data-num="2"]').click();
    await expect(page.locator("#name")).toHaveText("T-shirt");
    await expect(page.locator("#tot")).toHaveText("1");
    const picked = await answerCurrent(page, false);
    await page.locator("#nextBtn").click();
    await expect(page.locator("#endTitle")).toHaveText("Object #2 · Nov 11");
    await expect(page.locator("#final")).toHaveText("✗");
    await expect(page.locator("#verdict")).toContainText("From the archive");
    await expect(page.locator("#againBtn")).toHaveText("Back to past objects");
    expect(await stored(page)).toEqual(today);
    expect((await log(page))["2"]).toEqual({ g: picked, ok: false });

    await page.locator("#againBtn").click();
    await expect(page.locator("#archive")).toBeVisible();
    const row = page.locator('#arList .arrow[data-num="2"]');
    await expect(row.locator("small")).toHaveText("T-shirt (with a hole in it)");
    await expect(row.locator(".st")).toHaveText("✗");
    await expect(page.locator("#arSummary")).toContainText("1 of 3 played, 0 correct");

    // locked: opening it again shows the recorded answer and cannot change it
    await row.click();
    await expect(page.locator("#opts .opt:disabled")).toHaveCount(6);
    await expect(page.locator(`#opts .opt[data-g="${picked}"]`)).toHaveClass(/wrong/);
    await page.reload();
    expect((await log(page))["2"]).toEqual({ g: picked, ok: false });
    await expect(page.locator("#dTag")).toHaveText("✓ Done · streak 1");
    expect(errors).toEqual([]);
  });

  test("today's answer shows up in the archive the next day, including one saved before the archive existed", async ({ page }) => {
    await page.clock.setFixedTime(at(2026, 11, 13));
    await page.goto("./");
    // a record in the shape the previous version stored
    await page.evaluate(() => { localStorage.setItem("mugnut:daily", JSON.stringify({ day: "2026-11-12", g: 0, ok: true, streak: 1 })); localStorage.removeItem("mugnut:daily-log"); });
    await page.reload();
    await page.locator("#dailyBtn").click();
    await answerCurrent(page, true);
    expect((await stored(page)).streak).toBe(2);

    await page.clock.setFixedTime(at(2026, 11, 14));
    await page.reload();
    await page.locator("#archiveBtn").click();
    await expect(page.locator('#arList .arrow[data-num="4"] small')).toHaveText("Vase");
    await expect(page.locator('#arList .arrow[data-num="4"] .st')).toHaveText("✓");
    await expect(page.locator('#arList .arrow[data-num="3"] small')).toHaveText("Closed book");
    await expect(page.locator('#arList .arrow[data-num="3"] .st')).toHaveText("✓");
    await expect(page.locator("#arSummary")).toContainText("2 of 4 played, 2 correct");
  });

  test("a damaged archive record is ignored instead of breaking the game", async ({ page }) => {
    const errors = watchErrors(page);
    await page.clock.setFixedTime(at(2026, 11, 14));
    await page.goto("./");
    for (const bad of ['"oops"', "[1,2]", '{"2":{"g":99,"ok":true},"3":null,"__proto__":{"g":1}}', "{broken"]) {
      await page.evaluate(v => localStorage.setItem("mugnut:daily-log", v), bad);
      await page.reload();
      await page.locator("#archiveBtn").click();
      await expect(page.locator("#arList .arrow")).toHaveCount(4);
      await expect(page.locator("#arSummary")).toContainText("0 of 4 played");
      await page.locator('#arList .arrow[data-num="2"]').click();
      await expect(page.locator("#opts .opt:disabled")).toHaveCount(0);
      await page.locator("#quitBtn").click();
    }
    expect(errors).toEqual([]);
  });

  test("after playing, the menu and the result screen count down to the next object", async ({ page }) => {
    await page.clock.setFixedTime(at(2026, 11, 12, 18, 30));
    await page.goto("./");
    await expect(page.locator("#dNext")).toHaveText("");
    await page.locator("#dailyBtn").click();
    await answerCurrent(page, true);
    await page.locator("#nextBtn").click();
    await expect(page.locator("#verdict")).toHaveText("Day streak: 1. Next object in 5h 30m.");
    await page.clock.setFixedTime(at(2026, 11, 12, 23, 58, 0));
    await expect(page.locator("#verdict")).toHaveText("Day streak: 1. Next object in 2m 00s.");
    await page.locator("#homeBtn").click();
    await expect(page.locator("#dNext")).toHaveText("Next object in 2m 00s.");

    // at midnight the open menu switches to the new object by itself
    await page.clock.setFixedTime(at(2026, 11, 13, 0, 0, 1));
    await expect(page.locator("#dTag")).toHaveText("#4");
    await expect(page.locator("#dNext")).toHaveText("");
  });

  test("the archive fits a narrow phone", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.clock.setFixedTime(at(2026, 12, 30));
    await page.goto("./");
    await page.locator("#archiveBtn").click();
    await expect(page.locator("#arList .arrow")).toHaveCount(50);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
});
