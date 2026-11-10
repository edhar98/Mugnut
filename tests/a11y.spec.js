// Accessibility: an automated WCAG 2.1 A/AA audit (axe) of every screen, plus keyboard and screen-reader checks.
const path = require("path");
const AxeBuilder = require("@axe-core/playwright").default;
const { test, expect, stubSharing, lastCopied, newPhone, answerCurrent } = require("./helpers");

const PHOTO = path.join(__dirname, "fixtures", "photo.jpg");
const at = (y, m, d, h = 10) => new Date(Date.UTC(y, m - 1, d, h - 4));

async function audit(page, label) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const brief = r.violations.map(v => `${v.id}: ${v.help} — ${v.nodes.slice(0, 4).map(n => n.target.join(" ")).join(" | ")}`);
  expect(brief, label).toEqual([]);
}

test.beforeEach(async ({ context }) => { await stubSharing(context); });

for (const lang of ["en", "hy", "ru"]) {
  test(`every screen passes the automated audit (${lang})`, async ({ page, browser }, testInfo) => {
    await page.addInitScript(l => { try { if (!localStorage.getItem("mugnut:lang")) localStorage.setItem("mugnut:lang", JSON.stringify(l)); } catch (e) {} }, lang);
    await page.clock.setFixedTime(at(2026, 11, 14));
    await page.emulateMedia({ reducedMotion: "reduce" }); // audit the settled screens, not a frame of the fade-in
    await page.goto("./");
    await expect(page.locator("#home")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await audit(page, "home");
    await page.locator("#home details summary").click();
    await audit(page, "home with rules open");

    await page.locator("#journeyBtn").click();
    await audit(page, "interlude");
    await page.locator("#ilGo").click();
    await audit(page, "question");
    await answerCurrent(page, true);
    await audit(page, "feedback, correct");
    await page.locator("#nextBtn").click();
    await answerCurrent(page, false);
    await audit(page, "feedback, wrong");
    for (let i = 0; i < 2; i++) { await page.locator("#nextBtn").click(); await answerCurrent(page, false); }
    await page.locator("#nextBtn").click();
    await expect(page.locator("#end")).toBeVisible();
    await audit(page, "result with review list");
    await page.locator("#homeBtn").click();

    await page.locator("#dailyBtn").click();
    await answerCurrent(page, true);
    await page.locator("#nextBtn").click();
    await audit(page, "daily result");
    await page.locator("#homeBtn").click();
    await audit(page, "home after the daily object");
    await page.locator("#archiveBtn").click();
    await audit(page, "archive");
    await page.locator("#archive [data-home]").click();

    const pack = page.locator("#packBtns .lvbtn").first();
    if (await pack.count()) { await pack.click(); await audit(page, "pack question"); await page.locator("#quitBtn").click(); }

    await page.locator("#friendsBtn").click();
    await audit(page, "friends hub, empty");
    await page.locator("#newChBtn").click();
    await audit(page, "create");
    await page.locator("#postBtn").click();
    await audit(page, "create with an error");
    await page.locator("#galIn").setInputFiles(PHOTO);
    await expect(page.locator("#previewCard")).toBeVisible();
    await page.locator("#chName").fill("Keyring");
    await page.locator('#chOpts .opt[data-g="1"]').click();
    await page.locator("#myName").fill("Alice");
    await audit(page, "create, filled in");
    await page.locator("#postBtn").click();
    await expect(page.locator("#share")).toBeVisible();
    await page.locator("#shCopy").click();
    await audit(page, "share");
    const link = (await lastCopied(page)).split("\n").pop();
    await page.locator("#shareBack").click();
    await audit(page, "friends hub with a challenge");

    const ctx = await newPhone(browser, testInfo);
    await ctx.addInitScript(l => { try { localStorage.setItem("mugnut:lang", JSON.stringify(l)); } catch (e) {} }, lang);
    const bob = await ctx.newPage();
    await bob.emulateMedia({ reducedMotion: "reduce" });
    await bob.goto(link);
    await expect(bob.locator("#play")).toBeVisible();
    await audit(bob, "play a received challenge");
    await bob.locator('#plOpts .opt[data-g="2"]').click();
    await audit(bob, "received challenge, answered");
    await ctx.close();
  });
}

test("a keyboard-only player can finish a round; focus follows the action", async ({ page, browserName }) => {
  await page.goto("./");
  await page.locator('#levelBtns .lvbtn[data-lv="1"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#game")).toBeVisible();
  for (let i = 0; i < 10; i++) {
    await expect(page.locator("#num")).toHaveText(String(i + 1));
    // focus is inside the question, never lost to the page body
    expect(await page.evaluate(() => !!document.activeElement && document.activeElement !== document.body && !!document.activeElement.closest("#game"))).toBe(true);
    const g = await page.evaluate(() => G.deck[G.idx].g);
    await page.locator(`#opts .opt[data-g="${g}"]`).focus();
    await page.keyboard.press("Enter");
    // answering disables the options, so focus moves on to the button that continues
    await expect(page.locator("#nextBtn")).toBeFocused();
    await page.keyboard.press("Enter");
  }
  await expect(page.locator("#end")).toBeVisible();
  expect(await page.evaluate(() => !!document.activeElement.closest("#end"))).toBe(true);
  // a visible focus ring (Safari only tabs to buttons when the system setting for it is on, so this part is Chromium-only)
  if (browserName !== "chromium") return;
  await page.keyboard.press("Tab");
  const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2; });
  expect(ring).toBe(true);
});

test("screen readers are told the question, the options and the outcome", async ({ page }) => {
  await page.goto("./");
  await page.locator("#journeyBtn").click();
  await page.locator("#ilGo").click();
  const name = await page.locator("#name").textContent();
  await expect(page.locator("#pic svg")).toHaveAttribute("role", "img");
  expect(await page.locator("#pic svg").getAttribute("aria-label")).toContain(name);
  await expect(page.locator("#hearts")).toHaveAttribute("aria-label", "3 lives left");
  // option buttons: the name comes from the text, the little icon is decorative
  await expect(page.getByRole("button", { name: /^Torus\s*genus 1$/ })).toBeVisible();
  expect(await page.locator("#opts .opt svg").evaluateAll(els => els.every(e => e.getAttribute("aria-hidden") === "true"))).toBe(true);
  // the outcome is announced, and right/wrong is not conveyed by colour alone
  await expect(page.locator("#fb")).toHaveAttribute("role", "status");
  const g = await page.evaluate(() => G.deck[G.idx].g), wrong = (g + 1) % 6;
  await page.locator(`#opts .opt[data-g="${wrong}"]`).click();
  await expect(page.locator(`#opts .opt[data-g="${g}"]`)).toHaveAccessibleName(/correct answer/i);
  await expect(page.locator(`#opts .opt[data-g="${wrong}"]`)).toHaveAccessibleName(/your answer/i);
  await expect(page.locator("#hearts")).toHaveAttribute("aria-label", "2 lives left");
  // the hole rings are decoration for the eye; the legend text carries the meaning
  for (const m of await page.locator("#pic svg .marks").all()) await expect(m).toHaveAttribute("aria-hidden", "true"); // presence is tested in packs.spec.js
});

test("tap targets are at least 44 px tall on the main screens", async ({ page }) => {
  await page.clock.setFixedTime(at(2026, 11, 14));
  await page.goto("./");
  const small = async () => page.evaluate(() => [...document.querySelectorAll("button, summary, select, label.filebtn")].filter(e => e.offsetParent !== null).map(e => ({ id: e.id || e.className || e.textContent.trim().slice(0, 20), h: Math.round(e.getBoundingClientRect().height) })).filter(e => e.h < 44));
  expect(await small(), "home").toEqual([]);
  await page.locator("#archiveBtn").click();
  expect(await small(), "archive").toEqual([]);
  await page.locator("#archive [data-home]").click();
  await page.locator('#levelBtns .lvbtn[data-lv="1"]').click();
  expect(await small(), "question").toEqual([]);
  await answerCurrent(page, true);
  expect(await small(), "feedback").toEqual([]);
  await page.locator("#quitBtn").click();
  await page.locator("#friendsBtn").click();
  expect(await small(), "friends").toEqual([]);
  await page.locator("#newChBtn").click();
  expect(await small(), "create").toEqual([]);
});

test("nothing animates when the device asks for reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  await page.locator('#levelBtns .lvbtn[data-lv="1"]').click();
  await answerCurrent(page, true);
  const moving = await page.evaluate(() => [...document.querySelectorAll("*")].filter(e => { const s = getComputedStyle(e); return s.animationName !== "none" || parseFloat(s.transitionDuration) > 0; }).map(e => e.id || e.className));
  expect(moving).toEqual([]);
});
