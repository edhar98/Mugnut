// Sharp photos live in IndexedDB; localStorage keeps only the small records. Includes the move from the old layout.
const path = require("path");
const { test, expect, watchErrors, stubSharing, lastCopied, newPhone } = require("./helpers");

const PHOTO = path.join(__dirname, "fixtures", "photo.jpg");
const b64u = s => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const friends = page => page.evaluate(() => JSON.parse(localStorage.getItem("mugnut:friends")));
// what is in the photo store: {id: length of the stored data URL}
const idb = page => page.evaluate(() => new Promise((res, rej) => {
  const r = indexedDB.open("mugnut", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("photos");
  r.onerror = () => rej(r.error);
  r.onsuccess = () => {
    const db = r.result, out = {}, c = db.transaction("photos").objectStore("photos").openCursor();
    c.onsuccess = () => { const cur = c.result; if (cur) { out[cur.key] = String(cur.value).length; cur.continue(); } else { db.close(); res(out); } };
    c.onerror = () => rej(c.error);
  };
}));
// a JPEG data URL of the given size, drawn in the page
const jpeg = (page, w, h, color = "#7aa2d6") => page.evaluate(([w, h, color]) => {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d"); x.fillStyle = color; x.fillRect(0, 0, w, h); x.fillStyle = "#1f2a44"; x.fillRect(w / 4, h / 4, w / 2, h / 2);
  return c.toDataURL("image/jpeg", 0.8);
}, [w, h, color]);
const width = img => img.evaluate(i => new Promise(res => { const done = () => res(i.naturalWidth); if (i.complete && i.naturalWidth) done(); else i.addEventListener("load", done, { once: true }); }));

test.beforeEach(async ({ context }) => { await stubSharing(context); });

async function create(page, name = "Keyring") {
  await page.locator("#friendsBtn").click();
  await page.locator("#newChBtn").click();
  await page.locator("#galIn").setInputFiles(PHOTO);
  await expect(page.locator("#previewCard")).toBeVisible();
  await page.locator("#chName").fill(name);
  await page.locator('#chOpts .opt[data-g="1"]').click();
  await page.locator("#myName").fill("Alice");
  await page.locator("#postBtn").click();
  await expect(page.locator("#share")).toBeVisible();
  return Object.keys((await friends(page)).mine).pop();
}

test("a new challenge keeps its sharp photo in IndexedDB, not in localStorage", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("./");
  const id = await create(page);
  const rec = (await friends(page)).mine[id];
  expect(rec.full).toBeUndefined();
  expect(rec.sharp).toBe(true);
  expect(rec.thumb.length).toBeGreaterThan(100);
  const store = await idb(page);
  expect(Object.keys(store)).toEqual([id]);
  expect(store[id]).toBeGreaterThan(20000);
  expect(JSON.stringify(await friends(page)).length).toBeLessThan(40000); // previews only

  // the sharp copy is what is shown, also after a reload
  await expect.poll(() => page.locator("#shCard img").evaluate(i => i.naturalWidth)).toBe(900);
  await page.reload();
  await page.locator("#friendsBtn").click();
  await expect.poll(() => page.locator("#feed img").first().evaluate(i => i.naturalWidth)).toBe(900);

  // sharing again still attaches the full photo
  await page.getByRole("button", { name: "Share again" }).click();
  await expect(page.locator("#share")).toBeVisible();
  expect(await page.evaluate(() => shareCtx.file && shareCtx.file.size > 20000 && shareCtx.file.type)).toBe("image/jpeg");
  expect(errors).toEqual([]);
});

test("deleting a challenge deletes its photo", async ({ page }) => {
  await page.goto("./");
  const id = await create(page);
  await page.locator("#shareBack").click();
  const del = page.locator(`[data-del="${id}"]`);
  await del.click();
  await del.click();
  await expect(page.locator("#feed")).toContainText("You haven't sent any yet.");
  await expect.poll(() => idb(page)).toEqual({});
});

test("photos saved by the previous version are moved to IndexedDB on first load", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("./");
  const big1 = await jpeg(page, 900, 600), big2 = await jpeg(page, 800, 800, "#e07a5f"), small = (await jpeg(page, 60, 40)).split(",")[1];
  // the layout the live site wrote before this change: sharp photo inline as `full`
  await page.evaluate(([big1, big2, small]) => localStorage.setItem("mugnut:friends", JSON.stringify({
    mine: { m1: { id: "m1", name: "Old mine", note: "n", from: "Alice", g: 1, thumb: small, mime: "image/jpeg", full: big1, createdAt: 1, guesses: [{ by: "Bob", guess: 1, at: 2 }] } },
    received: {
      r1: { id: "r1", name: "Old received", note: "", from: "Bob", g: 2, thumb: small, mime: "image/jpeg", full: big2, createdAt: 3, openedAt: 4, guess: 2 },
      r2: { id: "r2", name: "No sharp copy", note: "", from: "Bob", g: 0, thumb: small, mime: "image/jpeg", createdAt: 5, openedAt: 6, guess: null },
    },
    postedDays: ["2026-11-10"],
  })), [big1, big2, small]);
  await page.reload();

  await expect.poll(async () => Object.keys(await idb(page)).sort()).toEqual(["m1", "r1"]);
  const store = await idb(page);
  expect(store).toEqual({ m1: big1.length, r1: big2.length }); // moved byte for byte
  await expect.poll(async () => { const d = await friends(page); return [d.mine.m1.full, d.received.r1.full, d.mine.m1.sharp, d.received.r1.sharp, d.received.r2.sharp]; }).toEqual([undefined, undefined, true, true, undefined]);
  const d = await friends(page);
  expect(d.mine.m1).toMatchObject({ name: "Old mine", g: 1, guesses: [{ by: "Bob", guess: 1, at: 2 }] });
  expect(d.postedDays).toEqual(["2026-11-10"]);

  await page.locator("#friendsBtn").click();
  await expect(page.locator("#feed")).toContainText("Old mine");
  await expect(page.locator("#feed")).toContainText("Old received");
  await expect.poll(() => page.locator("#feed img").evaluateAll(els => els.map(i => i.naturalWidth).sort((a, b) => a - b))).toEqual([60, 800, 900]);

  // a second load changes nothing
  await page.reload();
  await page.waitForTimeout(300);
  expect(await idb(page)).toEqual(store);
  expect(await friends(page)).toEqual(d);
  expect(errors).toEqual([]);
});

test("without IndexedDB the game still works, and old photos are left where they are", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "indexedDB", { value: { open() { throw new Error("no IndexedDB here"); } }, configurable: true }); });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto("./");
  const big = await jpeg(page, 900, 600), small = (await jpeg(page, 60, 40)).split(",")[1];
  await page.evaluate(([big, small]) => localStorage.setItem("mugnut:friends", JSON.stringify({ mine: { m1: { id: "m1", name: "Old mine", note: "", from: "Alice", g: 1, thumb: small, mime: "image/jpeg", full: big, createdAt: 1, guesses: [] } }, received: {}, postedDays: [] })), [big, small]);
  await page.reload();
  await page.waitForTimeout(300);
  expect((await friends(page)).mine.m1.full).toBe(big); // not thrown away when it cannot be moved
  await page.locator("#friendsBtn").click();
  await expect.poll(() => page.locator("#feed img").first().evaluate(i => i.naturalWidth)).toBe(900);
  await page.locator("#friends [data-home]").click();

  const id = await create(page, "New one");
  const rec = (await friends(page)).mine[id];
  expect(rec.sharp).toBeUndefined();
  expect(rec.full).toBeUndefined();
  await page.locator("#shCopy").click();
  expect(await lastCopied(page)).toContain("#c=");
  expect(await page.evaluate(() => shareCtx.file && shareCtx.file.size > 20000)).toBe(true); // this session's photo is still attached
  expect(errors).toEqual([]);
});

test("picking the photo from the chat stores the sharp copy and it stays after a reload", async ({ page, browser }, testInfo) => {
  await page.goto("./");
  await create(page, "Mug");
  await page.locator("#shCopy").click();
  const link = (await lastCopied(page)).split("\n").pop();

  const ctx = await newPhone(browser, testInfo);
  const bob = await ctx.newPage();
  await bob.goto(link);
  await expect(bob.locator("#play")).toBeVisible();
  await expect(bob.locator("#plFullLbl")).toBeVisible();
  await bob.locator("#plFullIn").setInputFiles(PHOTO);
  await expect(bob.locator("#plFullLbl")).toBeHidden();
  await expect.poll(() => bob.locator("#plImg").evaluate(i => i.naturalWidth)).toBe(900);
  await expect(bob.locator("#plImg")).not.toHaveClass(/tiny/);
  await expect.poll(async () => Object.keys(await idb(bob)).length).toBe(1);
  const rec = Object.values((await friends(bob)).received)[0];
  expect(rec.sharp).toBe(true);
  expect(rec.full).toBeUndefined();

  await bob.goto("./");
  await bob.reload();
  await bob.locator("#friendsBtn").click();
  await bob.getByRole("button", { name: "Play" }).click();
  await expect(bob.locator("#plFullLbl")).toBeHidden();
  await expect.poll(() => bob.locator("#plImg").evaluate(i => i.naturalWidth)).toBe(900);
  await ctx.close();
});

test("housekeeping: broken records are dropped, orphaned photos removed, and the lists still render", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("./");
  const big = await jpeg(page, 300, 200), small = (await jpeg(page, 60, 40)).split(",")[1];
  await page.evaluate(([big, small]) => new Promise((res, rej) => {
    const ok = { id: "good1", name: "Good one", note: "", from: "Bob", g: 1, thumb: small, mime: "image/jpeg", createdAt: 1, openedAt: 2, guess: 1 };
    localStorage.setItem("mugnut:friends", JSON.stringify({
      mine: {},
      // what a malformed link could leave behind on the previous version, plus plain junk
      received: { good1: ok, bad1: { ...ok, id: "bad1", name: "Bad one", g: null }, bad2: { ...ok, id: "bad2", name: "Bad two", g: 1.5 }, bad3: "junk", bad4: { ...ok, id: "other" }, bad5: { ...ok, id: "bad5", full: "javascript:alert(1)" } },
      postedDays: "nope",
    }));
    const r = indexedDB.open("mugnut", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("photos");
    r.onsuccess = () => { const tx = r.result.transaction("photos", "readwrite"); tx.objectStore("photos").put(big, "gone1"); tx.objectStore("photos").put("not a photo", "good1"); tx.oncomplete = () => { r.result.close(); res(); }; tx.onerror = () => rej(tx.error); };
    r.onerror = () => rej(r.error);
  }), [big, small]);
  await page.reload();
  await expect.poll(async () => Object.keys((await friends(page)).received).sort()).toEqual(["bad5", "good1"]);
  await expect.poll(async () => Object.keys(await idb(page))).toEqual(["good1"]); // the orphan is gone
  await expect.poll(async () => (await friends(page)).received.bad5.full).toBeUndefined(); // a `full` that is not an image is discarded, never used as a source
  await page.locator("#friendsBtn").click();
  await expect(page.locator("#feed")).toContainText("Good one");
  await expect(page.locator("#feed")).not.toContainText("Bad one");
  await expect(page.locator("#streakN")).toHaveText("0");
  expect(await page.locator("#feed img").evaluateAll(els => els.every(i => /^data:image\//.test(i.src)))).toBe(true);
  expect(errors).toEqual([]);
});

test("what a link can store is bounded: oversized previews are dropped and old received challenges make room", async ({ page }) => {
  await page.goto("./");
  const meta = { v: 1, id: "huge1", n: "Huge", t: "", f: "Mallory", k: 0, at: 1 };
  await page.goto("./#c=" + b64u(JSON.stringify(meta)) + "." + "A".repeat(60000));
  await expect(page.locator("#play")).toBeVisible();
  expect((await friends(page)).received.huge1.thumb).toBe("");
  await expect.poll(() => page.locator("#plImg").evaluate(i => i.dataset.ph)).toBe("1");

  // 200 already stored (half of them answered): one more arrives
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("mugnut:friends")); d.received = {};
    for (let i = 0; i < 200; i++) d.received["old" + i] = { id: "old" + i, name: "Old " + i, note: "", from: "Bob", g: 1, thumb: "", mime: "image/jpeg", createdAt: i, openedAt: i, guess: i % 2 ? 1 : null };
    localStorage.setItem("mugnut:friends", JSON.stringify(d));
  });
  await page.goto("./");
  await page.goto("./#c=" + b64u(JSON.stringify({ ...meta, id: "new1", n: "Newest" })) + ".");
  await expect(page.locator("#plName")).toHaveText("Newest");
  const rec = (await friends(page)).received;
  expect(Object.keys(rec)).toHaveLength(200);
  expect(rec.new1).toBeTruthy();
  expect(rec.old1).toBeUndefined();  // the oldest answered one made room
  expect(rec.old0).toBeTruthy();     // unanswered ones are kept
});
