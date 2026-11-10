// Home, level round and Journey.
const { test, expect, watchErrors, answerCurrent } = require("./helpers");

test("home renders at phone width with all modes and no errors", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("./");
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mugnut", level: 1 })).toBeVisible();
  await expect(page.locator("#dailyBtn")).toBeVisible();
  await expect(page.locator("#dTag")).toHaveText(/^#\d+$/);
  await expect(page.locator("#journeyBtn")).toBeVisible();
  await expect(page.locator("#levelBtns .lvbtn")).toHaveCount(4);
  await expect(page.locator("#levelBtns .lvbtn")).toContainText(["Easy", "Medium", "Hard", "Expert"]);
  await expect(page.locator("#friendsBtn")).toBeVisible();
  for (const id of ["interlude", "game", "end", "friends", "create", "share", "play"]) {
    await expect(page.locator("#" + id)).toBeHidden();
  }
  // nothing spills sideways on a phone
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test("static assets referenced by the page, manifest and service worker all load", async ({ page, request }) => {
  await page.goto("./");
  const sw = await (await request.get("sw.js")).text();
  const files = JSON.parse(sw.match(/const FILES = (\[[\s\S]*?\]);/)[1]);
  expect(files.length).toBeGreaterThan(3);
  for (const f of files) expect((await request.get(f)).status(), f).toBe(200);
  const manifest = await (await request.get("manifest.webmanifest")).json();
  for (const i of manifest.icons) expect((await request.get(i.src)).status(), i.src).toBe(200);
});

test("a full Easy round: 10 questions, score, review list and best score", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("./");
  await page.locator('#levelBtns .lvbtn[data-lv="1"]').click();
  await expect(page.locator("#game")).toBeVisible();
  await expect(page.locator("#tot")).toHaveText("10");
  await expect(page.locator("#hearts")).toHaveText(""); // no lives in a level round

  const seen = new Set();
  for (let i = 0; i < 10; i++) {
    await expect(page.locator("#num")).toHaveText(String(i + 1));
    await expect(page.locator("#lvChip")).toHaveText("Easy");
    await expect(page.locator("#pic svg")).toBeVisible();
    const name = await page.locator("#name").textContent();
    expect(name.trim()).not.toBe("");
    seen.add(name + "|" + (await page.locator("#sub").textContent()));
    await expect(page.locator("#opts .opt")).toHaveCount(6);
    await expect(page.locator("#fb")).toBeHidden();

    await answerCurrent(page, i !== 3); // one deliberate miss
    await expect(page.locator("#opts .opt.correct")).toHaveCount(1);
    await expect(page.locator("#opts .opt.wrong")).toHaveCount(i === 3 ? 1 : 0);
    await expect(page.locator("#opts .opt:disabled")).toHaveCount(6);
    await expect(page.locator("#fbTitle")).toHaveText(i === 3 ? /^Not quite/ : /^Correct/);
    await expect(page.locator("#fbText")).not.toHaveText("");
    await expect(page.locator("#nextBtn")).toHaveText(i === 9 ? "See results" : "Next");
    await page.locator("#nextBtn").click();
  }
  expect(seen.size).toBe(10); // no object repeats within a round

  await expect(page.locator("#end")).toBeVisible();
  await expect(page.locator("#endTitle")).toHaveText("Easy complete");
  await expect(page.locator("#final")).toHaveText("9/10");
  await expect(page.locator("#review li")).toHaveCount(1);
  await expect(page.locator("#againBtn")).toHaveText("Play again");

  await page.locator("#homeBtn").click();
  await expect(page.locator('#levelBtns .lvbtn[data-lv="1"]')).toContainText("Best 9/10");
  await page.reload();
  await expect(page.locator('#levelBtns .lvbtn[data-lv="1"]')).toContainText("Best 9/10");
  expect(errors).toEqual([]);
});

test("Journey ends after losing 3 lives", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("./");
  await page.locator("#journeyBtn").click();

  await expect(page.locator("#interlude")).toBeVisible();
  await expect(page.locator("#ilChip")).toHaveText("Level 1 of 4");
  await page.locator("#ilGo").click();
  await expect(page.locator("#game")).toBeVisible();
  await expect(page.locator("#tot")).toHaveText("24");
  await expect(page.locator("#hearts")).toHaveText("♥♥♥");

  await answerCurrent(page, true);
  await expect(page.locator("#sc")).toHaveText("1");
  await page.locator("#nextBtn").click();

  await answerCurrent(page, false);
  await expect(page.locator("#hearts")).toHaveText("♥♥♡");
  await page.locator("#nextBtn").click();
  await answerCurrent(page, false);
  await expect(page.locator("#hearts")).toHaveText("♥♡♡");
  await page.locator("#nextBtn").click();
  await answerCurrent(page, false);
  await expect(page.locator("#hearts")).toHaveText("♡♡♡");
  await expect(page.locator("#nextBtn")).toHaveText("Out of lives — see results");
  await page.locator("#nextBtn").click();

  await expect(page.locator("#end")).toBeVisible();
  await expect(page.locator("#endTitle")).toHaveText("Journey over");
  await expect(page.locator("#final")).toHaveText("1/24");
  await expect(page.locator("#verdict")).toHaveText("You made it to Easy.");
  await expect(page.locator("#review li")).toHaveCount(3);

  await page.locator("#homeBtn").click();
  await expect(page.locator("#jBest")).toHaveText("Best 1/24");
  expect(errors).toEqual([]);
});

test("a flawless Journey walks through all four levels", async ({ page }) => {
  await page.goto("./");
  await page.locator("#journeyBtn").click();
  for (let i = 0; i < 24; i++) {
    if (i % 6 === 0) {
      await expect(page.locator("#ilChip")).toHaveText(`Level ${i / 6 + 1} of 4`);
      await page.locator("#ilGo").click();
    }
    await expect(page.locator("#num")).toHaveText(String(i + 1));
    await answerCurrent(page, true);
    await page.locator("#nextBtn").click();
  }
  await expect(page.locator("#endTitle")).toHaveText("Journey complete!");
  await expect(page.locator("#final")).toHaveText("24/24");
  await expect(page.locator("#reviewCard")).toBeHidden();
});

test("quitting mid-round returns to the menu", async ({ page }) => {
  await page.goto("./");
  await page.locator('#levelBtns .lvbtn[data-lv="2"]').click();
  await expect(page.locator("#lvChip")).toHaveText("Medium");
  await page.locator("#quitBtn").click();
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator("#game")).toBeHidden();
});

test("works opened straight from the file system, with no server and no build", async ({ page }) => {
  // Only uncaught exceptions count here: WebKit logs a harmless CORS notice for the manifest on file://.
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto("file://" + require("path").resolve(__dirname, "..", "index.html"));
  await expect(page.locator("#home")).toBeVisible();
  await page.locator('#levelBtns .lvbtn[data-lv="1"]').click();
  await answerCurrent(page, true);
  await page.locator("#nextBtn").click();
  await expect(page.locator("#num")).toHaveText("2");
  await page.locator("#quitBtn").click();
  await page.locator("#dailyBtn").click();
  await answerCurrent(page, true);
  await page.locator("#nextBtn").click();
  await expect(page.locator("#end")).toBeVisible();
  expect(errors).toEqual([]);
});
