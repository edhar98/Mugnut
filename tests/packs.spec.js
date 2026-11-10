// Themed packs and the hole rings.
const { test, expect, watchErrors, answerCurrent } = require("./helpers");

test("a pack round: ten objects from that pack, its own best score, play again stays in the pack", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("./");
  await expect(page.locator("#packBtns .lvbtn")).toHaveCount(5);
  await expect(page.locator("#objCount")).toHaveText(String(await page.evaluate(() => OBJECTS.length)));
  const btn = page.locator('#packBtns .lvbtn[data-pack="kitchen"]');
  await expect(btn).toContainText("Kitchen");
  await expect(btn).toContainText(/\d+ objects/);
  await btn.click();
  await expect(page.locator("#tot")).toHaveText("10");
  await expect(page.locator("#hearts")).toHaveText("");
  const seen = new Set();
  for (let i = 0; i < 10; i++) {
    expect(await page.evaluate(() => G.deck[G.idx].pack)).toBe("kitchen");
    seen.add(await page.evaluate(() => G.deck[G.idx].name + "|" + (G.deck[G.idx].sub || "")));
    await answerCurrent(page, i < 8);
    await page.locator("#nextBtn").click();
  }
  expect(seen.size).toBe(10);
  await expect(page.locator("#endTitle")).toHaveText("Kitchen complete");
  await expect(page.locator("#final")).toHaveText("8/10");
  await expect(page.locator("#review li")).toHaveCount(2);
  await page.locator("#againBtn").click();
  expect(await page.evaluate(() => [G.mode, G.pack, G.deck.every(o => o.pack === "kitchen")])).toEqual(["pack", "kitchen", true]);
  await page.locator("#quitBtn").click();
  await expect(btn).toContainText("Best 8/10");
  await expect(page.locator('#levelBtns .lvbtn[data-lv="1"]')).not.toContainText("Best"); // a pack score is not a level score
  // an id that is not a pack does nothing
  await page.evaluate(() => { startPack("__proto__"); startPack("nope"); });
  await expect(page.locator("#home")).toBeVisible();
  expect(errors).toEqual([]);
});

test("every pack can be played to the end", async ({ page }) => {
  await page.goto("./");
  for (const id of await page.evaluate(() => Object.keys(PACKS))) {
    await page.locator(`#packBtns .lvbtn[data-pack="${id}"]`).click();
    for (let i = 0; i < 10; i++) { await answerCurrent(page, true); await page.locator("#nextBtn").click(); }
    await expect(page.locator("#final")).toHaveText("10/10");
    await page.locator("#homeBtn").click();
  }
});

test("hole rings appear only after the answer, and match the object", async ({ page }) => {
  await page.goto("./");
  const show = name => page.evaluate(n => { const o = OBJECTS.find(o => o.name === n && !o.sub); G = { mode: "level", lv: o.lv, deck: [o, o], idx: 0, score: 0, lives: null, missed: [], lastLv: o.lv }; show("game"); renderQ(); return o.g; }, name);
  const rings = () => page.locator("#pic svg .marks circle[stroke-dasharray], #pic svg .marks circle:not([stroke='#fff']):not([stroke-dasharray])");
  const solid = () => page.locator("#pic svg .marks circle:not([stroke='#fff']):not([stroke-dasharray])");
  const dashed = () => page.locator("#pic svg .marks circle[stroke-dasharray]");

  // two real holes
  let g = await show("Scissors");
  await expect(page.locator("#pic svg .marks")).toHaveCount(0); // nothing gives the answer away
  await expect(page.locator("#fbMarks")).toBeHidden();
  await page.locator(`#opts .opt[data-g="${g}"]`).click();
  await expect(solid()).toHaveCount(2);
  await expect(dashed()).toHaveCount(0);
  await expect(page.locator("#fbMarks")).toHaveText("the 2 holes");
  await expect(page.locator("#pic svg .marks")).toHaveAttribute("aria-hidden", "true");
  // the next question starts clean
  await page.locator("#nextBtn").click();
  await expect(page.locator("#pic svg .marks")).toHaveCount(0);
  await expect(page.locator("#fbMarks")).toBeHidden();

  // openings into one space: n openings, n − 1 holes
  g = await show("T-shirt");
  await expect(page.locator("#pic svg .marks")).toHaveCount(0);
  await page.locator(`#opts .opt[data-g="${(g + 1) % 6}"]`).click(); // rings show after a wrong answer too
  await expect(dashed()).toHaveCount(4);
  await expect(solid()).toHaveCount(0);
  await expect(page.locator("#fbMarks")).toHaveText("4 openings into one space, which make 3 holes");

  // no holes: no rings and no legend
  g = await show("Brick");
  await page.locator(`#opts .opt[data-g="${g}"]`).click();
  await expect(rings()).toHaveCount(0);
  await expect(page.locator("#fbMarks")).toBeHidden();
});

test("the locked daily object shows its rings only as part of the recorded answer", async ({ page }) => {
  await page.clock.setFixedTime(new Date(Date.UTC(2026, 10, 12, 6)));
  await page.goto("./");
  await page.locator("#dailyBtn").click();
  await expect(page.locator("#pic svg .marks")).toHaveCount(0);
  await answerCurrent(page, true);
  await page.locator("#nextBtn").click();
  await page.locator("#homeBtn").click();
  await page.locator("#dailyBtn").click();
  await expect(page.locator("#opts .opt:disabled")).toHaveCount(6);
  await expect(page.locator("#fb")).toBeVisible();
});

test("holding the key down on an answer does not skip its explanation", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "key auto-repeat is emulated reliably only in Chromium");
  await page.goto("./");
  await page.locator('#levelBtns .lvbtn[data-lv="1"]').click();
  const g = await page.evaluate(() => G.deck[G.idx].g);
  await page.locator(`#opts .opt[data-g="${g}"]`).focus();
  await page.keyboard.down("Enter");
  for (let i = 0; i < 5; i++) await page.keyboard.down("Enter"); // auto-repeat
  await page.keyboard.up("Enter");
  await expect(page.locator("#num")).toHaveText("1");
  await expect(page.locator("#fb")).toBeVisible();
  await page.keyboard.press("Enter"); // a fresh press does continue
  await expect(page.locator("#num")).toHaveText("2");
});

test("if the object data fails to load, the page says so and offers a reload", async ({ page }) => {
  await page.route("**/objects.js", r => r.abort());
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto("./");
  await expect(page.getByText("did not finish loading")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
  await expect(page.locator("#journeyBtn")).toHaveCount(0);
  expect(errors.join()).toContain("did not load");
});
