// Friend challenges: the whole link round trip between two phones with separate storage.
const path = require("path");
const { test, expect } = require("@playwright/test");
const { watchErrors, stubSharing, lastCopied, newPhone } = require("./helpers");

const PHOTO = path.join(__dirname, "fixtures", "photo.jpg");
const linkIn = text => text.split("\n").pop();
const b64u = s => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

test.beforeEach(async ({ context }) => { await stubSharing(context); });

async function createChallenge(page, { name, g, note, from }) {
  await page.goto("./");
  await page.locator("#friendsBtn").click();
  await expect(page.locator("#friends")).toBeVisible();
  await page.locator("#newChBtn").click();
  await page.locator("#galIn").setInputFiles(PHOTO);
  await expect(page.locator("#previewCard")).toBeVisible();
  await page.locator("#chName").fill(name);
  await page.locator(`#chOpts .opt[data-g="${g}"]`).click();
  await expect(page.locator(`#chOpts .opt[data-g="${g}"]`)).toHaveClass(/sel/);
  await page.locator("#chNote").fill(note);
  await page.locator("#myName").fill(from);
  await page.locator("#postBtn").click();
  await expect(page.locator("#share")).toBeVisible();
  await page.locator("#shCopy").click();
  await expect(page.locator("#shErr")).toHaveText("Link copied — paste it into any chat.");
  return lastCopied(page);
}

test("create a challenge, friend answers on another phone, reply lands back", async ({ page, browser }, testInfo) => {
  const errors = watchErrors(page);

  // --- Alice creates a challenge ---
  const message = await createChallenge(page, { name: "My keyring", g: 1, note: "One ring, one hole.", from: "Alice" });
  expect(message.length).toBeLessThanOrEqual(1000); // must fit a WhatsApp/Telegram photo caption
  expect(message).toContain("Alice challenges you");
  const challengeUrl = linkIn(message);
  // Browsers that cannot encode WebP (Safari) have no preview small enough for a caption: the part after the dot is empty.
  const webp = await page.evaluate(() => WEBP_OK);
  expect(challengeUrl).toMatch(webp ? /#c=[\w-]+\.[\w-]+$/ : /#c=[\w-]+\.[\w-]*$/);
  // the answer is not readable from the link at a glance
  const meta = JSON.parse(Buffer.from(challengeUrl.split("#c=")[1].split(".")[0], "base64url").toString());
  expect(meta).not.toHaveProperty("g");
  await expect(page.locator("#shCard")).toContainText("Answer: torus (genus 1)");

  await page.locator("#shareBack").click();
  await expect(page.locator("#streakN")).toHaveText("1");
  await expect(page.locator("#feed")).toContainText("My keyring");
  await expect(page.locator("#feed")).toContainText("No answers yet");

  // --- Bob opens the link on his own phone (fresh storage) ---
  const bobCtx = await newPhone(browser, testInfo);
  const bob = await bobCtx.newPage();
  const bobErrors = watchErrors(bob);
  await bob.goto(challengeUrl);
  await expect(bob.locator("#play")).toBeVisible();
  await expect(bob.locator("#plName")).toHaveText("My keyring");
  await expect(bob.locator("#plFrom")).toContainText("From Alice");
  expect(bob.url()).not.toContain("#c="); // link is consumed so a reload does not re-trigger it
  // the preview that travelled in the link is a real, decodable image; without one, the placeholder stands in
  await expect.poll(() => bob.locator("#plImg").evaluate(i => i.complete && i.naturalWidth > 0)).toBe(true);
  expect(await bob.locator("#plImg").evaluate(i => !i.dataset.ph)).toBe(webp);
  await expect(bob.locator("#plFb")).toBeHidden();

  await bob.locator('#plOpts .opt[data-g="2"]').click(); // Bob guesses wrong
  await expect(bob.locator("#plFbTitle")).toHaveText("Alice says it's torus (genus 1).");
  await expect(bob.locator("#plFbText")).toHaveText("One ring, one hole.");
  await expect(bob.locator('#plOpts .opt[data-g="1"]')).toHaveClass(/correct/);
  await expect(bob.locator('#plOpts .opt[data-g="2"]')).toHaveClass(/wrong/);

  // a name is required before replying
  await bob.locator("#plReply").click();
  await expect(bob.locator("#play")).toBeVisible();
  await bob.locator("#plMyName").fill("Bob");
  await bob.locator("#plReply").click();
  await expect(bob.locator("#share")).toBeVisible();
  await expect(bob.locator("#shTitle")).toHaveText("Send your answer to Alice");
  await bob.locator("#shCopy").click();
  const replyUrl = linkIn(await lastCopied(bob));
  expect(replyUrl).toMatch(/#r=[\w-]+$/);

  // Bob's guess is locked in: reopening the challenge link shows it answered
  await bob.goto(challengeUrl);
  await bob.reload();
  await bob.goto(challengeUrl);
  await expect(bob.locator("#plOpts .opt:disabled")).toHaveCount(6);
  expect(bobErrors).toEqual([]);
  await bobCtx.close();

  // --- Alice opens the reply link ---
  await page.goto(replyUrl);
  await expect(page.locator("#friends")).toBeVisible();
  await expect(page.locator("#fNote")).toHaveText("Bob answered “My keyring”: double torus ✗");
  await expect(page.locator("#feed .guesses li")).toHaveCount(1);
  await expect(page.locator("#feed .guesses li")).toContainText("Bob");
  await expect(page.locator("#feed .guesses li")).toContainText("Double torus ✗");
  expect(page.url()).not.toContain("#r=");

  // opening the same reply twice does not duplicate it, and it survives a reload
  await page.goto(replyUrl);
  await page.reload();
  await page.locator("#friendsBtn").click();
  await expect(page.locator("#feed .guesses li")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("opening your own challenge link does not let you play it", async ({ page }) => {
  const message = await createChallenge(page, { name: "Colander", g: 5, note: "Lots of holes.", from: "Alice" });
  await page.goto("./");
  await page.goto(linkIn(message));
  await expect(page.locator("#friends")).toBeVisible();
  await expect(page.locator("#fNote")).toHaveText("That's one of your own challenges.");
});

test("a pasted link works like an opened one", async ({ page, browser }, testInfo) => {
  const message = await createChallenge(page, { name: "Scissors", g: 2, note: "Two finger holes.", from: "Alice" });
  const ctx = await newPhone(browser, testInfo);
  const p2 = await ctx.newPage();
  await p2.goto("./");
  await p2.locator("#friendsBtn").click();
  await p2.locator("details", { hasText: "Got a link on another device?" }).locator("summary").click();
  await p2.locator("#pasteIn").fill(linkIn(message));
  await p2.locator("#pasteBtn").click();
  await expect(p2.locator("#play")).toBeVisible();
  await expect(p2.locator("#plName")).toHaveText("Scissors");
  await ctx.close();
});

test.describe("links are untrusted input", () => {
  test("a broken link shows a friendly message instead of crashing", async ({ page }) => {
    const errors = [];
    page.on("pageerror", e => errors.push(String(e)));
    await page.goto("./#c=%%%not-a-link");
    await expect(page.locator("#fNote")).toContainText("broken or incomplete");
    await page.goto("./");
    await page.goto("./#r=" + b64u("{not json"));
    await expect(page.locator("#fNote")).toContainText("broken or incomplete");
    expect(errors).toEqual([]);
  });

  test("a challenge link without a preview still opens, with a placeholder photo", async ({ page }) => {
    const meta = { v: 1, id: "nopreview1", n: "Paperclip", t: "", f: "Alice", k: 2, at: Date.now() };
    for (const tail of [".", ""]) {
      await page.goto("./");
      await page.goto("./#c=" + b64u(JSON.stringify(meta)) + tail);
      await expect(page.locator("#play")).toBeVisible();
      await expect(page.locator("#plName")).toHaveText("Paperclip");
      await expect.poll(() => page.locator("#plImg").evaluate(i => i.dataset.ph === "1" && i.naturalWidth > 0)).toBe(true);
    }
  });

  test("a challenge link with a non-integer answer key or an odd id is rejected and nothing is stored", async ({ page }) => {
    const errors = [];
    page.on("pageerror", e => errors.push(String(e)));
    const bad = [{ id: "badkey1", k: "x" }, { id: "badkey2", k: 1.5 }, { id: "__proto__", k: 1 }, { id: "a b<c>", k: 1 }, { id: "", k: 1 }];
    for (const { id, k } of bad) {
      await page.goto("./");
      await page.goto("./#c=" + b64u(JSON.stringify({ v: 1, id, n: "Thing", t: "", f: "Mallory", k, at: 1 })) + ".AAAA");
      await expect(page.locator("#fNote"), JSON.stringify({ id, k })).toContainText("broken or incomplete");
      await expect(page.locator("#feed")).not.toContainText("Thing");
    }
    expect(await page.evaluate(() => Object.keys((JSON.parse(localStorage.getItem("mugnut:friends")) || { received: {} }).received))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("ids that name built-in object properties cannot reach the prototype", async ({ page }) => {
    const errors = [];
    page.on("pageerror", e => errors.push(String(e)));
    for (const id of ["__proto__", "constructor", "toString"]) {
      await page.goto("./");
      await page.goto("./#r=" + b64u(JSON.stringify({ v: 1, id, g: 1, by: "Mallory", at: 1 })));
      await expect(page.locator("#fNote"), id).toContainText("isn't saved on this device");
    }
    expect(await page.evaluate(() => [({}).guesses, Object.guesses, Object.prototype.toString.guesses].every(v => v === undefined))).toBe(true);
    // a challenge whose id is a built-in name is an ordinary challenge, not "one of your own"
    await page.goto("./");
    await page.goto("./#c=" + b64u(JSON.stringify({ v: 1, id: "constructor", n: "Odd one", t: "", f: "Eve", k: 0, at: 1 })) + ".");
    await expect(page.locator("#play")).toBeVisible();
    await expect(page.locator("#plName")).toHaveText("Odd one");
    expect(errors).toEqual([]);
  });

  test("markup in a challenge link is shown as text, never executed", async ({ page }) => {
    const evil = `<img src=x onerror="window.__xss=1">`;
    const meta = { v: 1, id: "abc123", n: evil, t: evil, f: `<b onclick="window.__xss=1">x</b>`, k: 3, at: Date.now() };
    await page.goto("./#c=" + b64u(JSON.stringify(meta)) + "." + b64u("not an image"));
    await expect(page.locator("#play")).toBeVisible();
    await expect(page.locator("#plName")).toHaveText(evil);
    await page.locator("#plOpts .opt").first().click();
    await expect(page.locator("#plFb")).toBeVisible();
    await page.locator("#playBack").click();
    await expect(page.locator("#feed")).toContainText("<img src=x");
    expect(await page.locator("#play img, #feed img").evaluateAll(els => els.every(e => !e.hasAttribute("onerror")))).toBe(true);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });

  test("an answer link with an out-of-range guess or unknown challenge is rejected", async ({ page }) => {
    const message = await createChallenge(page, { name: "Bagel", g: 1, note: "", from: "Alice" });
    const id = JSON.parse(Buffer.from(linkIn(message).split("#c=")[1].split(".")[0], "base64url").toString()).id;
    await page.goto("./");
    await page.goto("./#r=" + b64u(JSON.stringify({ v: 1, id, g: 99, by: "Mallory", at: 1 })));
    await expect(page.locator("#fNote")).toContainText("broken or incomplete");
    await expect(page.locator("#feed .guesses li")).toHaveCount(0);
    await page.goto("./");
    await page.goto("./#r=" + b64u(JSON.stringify({ v: 1, id, g: 1.5, by: "Mallory", at: 2 })));
    await expect(page.locator("#fNote")).toContainText("broken or incomplete");
    await page.reload();
    await page.locator("#friendsBtn").click();
    await expect(page.locator("#feed")).toContainText("Bagel");
    await expect(page.locator("#feed .guesses li")).toHaveCount(0);
    await page.goto("./");
    await page.goto("./#r=" + b64u(JSON.stringify({ v: 1, id: "nope", g: 1, by: "Mallory", at: 1 })));
    await expect(page.locator("#fNote")).toContainText("isn't saved on this device");
  });
});
