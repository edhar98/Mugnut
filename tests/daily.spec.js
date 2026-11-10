// Daily mode: one object per calendar day, locked after answering, with a day streak.
const { test, expect } = require("@playwright/test");
const { watchErrors, stubSharing, lastCopied, answerCurrent } = require("./helpers");

const at = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0);
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
  expect(await stored(page)).toEqual({ day: "2026-11-12", g: picked, ok: true, streak: 1 });

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
  expect(await stored(page)).toEqual({ day: "2026-11-12", g: picked, ok: true, streak: 1 });

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
