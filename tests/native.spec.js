// The game inside the native app shell, exercised in the browser against a stand-in for Capacitor and its plugins.
// This checks the game's side of every native feature and the whole unlock flow. It cannot check the real plugins,
// StoreKit or Play Billing: that needs a device build (see HUMAN_TODO.md).
const fs = require("fs");
const path = require("path");
const AxeBuilder = require("@axe-core/playwright").default;
const { test, expect, watchErrors, stubSharing, lastCopied, newPhone, answerCurrent } = require("./helpers");

// The app shell is simulated on the local test server. On a deployed copy the page (rightly) refuses to act as the
// app, so these tests have nothing to check there.
test.skip(() => !!process.env.MUGNUT_URL, "the simulated app shell only exists on the local test server");

const PHOTO = path.join(__dirname, "fixtures", "photo.jpg");
const PHOTO_URL = "data:image/jpeg;base64," + fs.readFileSync(PHOTO).toString("base64");

// What the fake shell is told to do. store: what the account owns and how a purchase ends.
function shell(opts = {}) {
  return [({ photo, opts }) => {
    const calls = (window.__calls = []);
    const log = (plugin, method, arg) => { calls.push({ plugin, method, arg }); };
    const state = (window.__shell = Object.assign({ owned: false, buy: "ok", price: "$2.99", permission: "granted", storeDown: false, share: "ok", launch: null, noStore: false }, opts));
    const persisted = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    if (persisted("test:owned") === "1") state.owned = true; // the "account" outlives a reload
    const Plugins = {
      Haptics: { notification: async o => log("Haptics", "notification", o), impact: async o => log("Haptics", "impact", o) },
      Filesystem: { writeFile: async o => { log("Filesystem", "writeFile", { path: o.path, directory: o.directory, bytes: o.data.length }); return { uri: "file:///cache/" + o.path }; } },
      Share: { share: async o => { log("Share", "share", o); if (state.share === "cancel") throw new Error("Share canceled"); if (state.share === "fail") throw new Error("boom"); return {}; } },
      Camera: { takePhoto: async o => { log("Camera", "takePhoto", o); return state.camera === "cancel" ? Promise.reject(new Error("User cancelled photos app")) : { webPath: photo }; } },
      LocalNotifications: {
        requestPermissions: async () => { log("LocalNotifications", "requestPermissions"); return { display: state.permission }; },
        schedule: async o => { log("LocalNotifications", "schedule", o); return { notifications: o.notifications.map(n => ({ id: n.id })) }; },
        cancel: async o => { log("LocalNotifications", "cancel", o); },
      },
      App: { addListener: (name, cb) => { log("App", "addListener", name); if (name === "appUrlOpen") window.__open = url => cb({ url }); if (name === "backButton") window.__back = () => cb({ canGoBack: false }); return Promise.resolve({ remove() {} }); }, getLaunchUrl: async () => (state.launch ? { url: state.launch } : undefined), minimizeApp: async () => log("App", "minimizeApp") },
      NativePurchases: {
        isBillingSupported: async () => ({ isBillingSupported: !state.storeDown }),
        getProduct: async o => { log("NativePurchases", "getProduct", o); if (state.storeDown) throw new Error("offline"); return { product: { identifier: o.productIdentifier, priceString: state.price } }; },
        purchaseProduct: async o => {
          log("NativePurchases", "purchaseProduct", o);
          const err = (message, code) => Object.assign(new Error(message), code ? { code } : {});
          if (state.buy === "cancel") throw state.platform === "android" ? err("Purchase is not purchased", "USER_CANCELED") : err("User cancelled");
          if (state.buy === "fail") throw err("Payment declined");
          if (state.buy === "owned") { state.owned = true; throw err("Purchase is not purchased", "ITEM_ALREADY_OWNED"); }
          if (state.buy === "ask") throw err("Transaction pending");
          if (state.buy === "pending") { state.pending = true; return { transactionId: "t1", productIdentifier: o.productIdentifier, purchaseState: "2", purchaseToken: "tok1", isAcknowledged: false }; }
          state.owned = true; localStorage.setItem("test:owned", "1");
          return state.platform === "android" ? { transactionId: "t1", productIdentifier: o.productIdentifier, purchaseState: "1", purchaseToken: "tok1", isAcknowledged: false } : { transactionId: "t1", productIdentifier: o.productIdentifier };
        },
        acknowledgePurchase: async o => { log("NativePurchases", "acknowledgePurchase", o); state.acked = true; },
        restorePurchases: async () => { log("NativePurchases", "restorePurchases"); if (state.storeDown) throw new Error("offline"); },
        getPurchases: async o => {
          log("NativePurchases", "getPurchases", o);
          const ownedWhenAsked = state.owned;
          if (state.slow) await new Promise(r => setTimeout(r, state.slow)); // answers with what was true when asked
          if (state.storeDown) throw new Error("offline");
          const android = state.platform === "android";
          const list = [];
          if (ownedWhenAsked) list.push(android ? { transactionId: "t1", productIdentifier: "unlock_all", purchaseState: "1", purchaseToken: "tok1", isAcknowledged: !!state.acked } : { transactionId: "t1", productIdentifier: "unlock_all" });
          if (state.pending) list.push({ transactionId: "t2", productIdentifier: "unlock_all", purchaseState: "2", purchaseToken: "tok2", isAcknowledged: false });
          return { purchases: list };
        },
      },
    };
    if (state.noStore) delete Plugins.NativePurchases;
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => state.platform || "ios", Plugins };
  }, { photo: PHOTO_URL, opts }];
}
const calls = (page, plugin, method) => page.evaluate(([p, m]) => window.__calls.filter(c => c.plugin === p && (!m || c.method === m)), [plugin, method]);
const openApp = async (page, opts) => { await page.addInitScript(...shell(opts)); await page.goto("./"); await expect(page.locator("#home")).toBeVisible(); };

test.describe("on the web nothing changes", () => {
  test("no paywall, no reminder switch, the service worker still registers", async ({ page }) => {
    await page.goto("./");
    expect(await page.evaluate(() => [NATIVE, Store.paywall, Store.unlocked(), isLocked()])).toEqual([false, false, true, false]);
    await expect(page.locator("#remindRow")).toBeHidden();
    await expect(page.locator("#levelBtns")).not.toContainText("🔒");
    await expect(page.locator("#packBtns")).not.toContainText("🔒");
    await page.locator('#levelBtns .lvbtn[data-lv="4"]').click();
    await expect(page.locator("#lvChip")).toHaveText("Expert");
    await page.locator("#quitBtn").click();
    await page.locator("#journeyBtn").click();
    await page.locator("#ilGo").click();
    await expect(page.locator("#tot")).toHaveText("24");
    // even with a purchase flag or a mock switch in storage there is still no paywall on the web
    await page.evaluate(() => { localStorage.removeItem("mugnut:unlock"); window.MUGNUT_MOCK_STORE = true; });
    expect(await page.evaluate(() => isLocked())).toBe(false);
  });
});

test.describe("free part of the app", () => {
  test("Easy, Medium, the daily object and friend challenges are open; the rest asks to unlock", async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page);
    await expect(page.locator('#levelBtns .lvbtn[data-lv="1"]')).not.toContainText("🔒");
    await expect(page.locator('#levelBtns .lvbtn[data-lv="2"]')).not.toContainText("🔒");
    await expect(page.locator('#levelBtns .lvbtn[data-lv="3"]')).toContainText("🔒 Unlock");
    await expect(page.locator('#levelBtns .lvbtn[data-lv="4"]')).toContainText("🔒 Unlock");
    await expect(page.locator("#packBtns .lvbtn")).toHaveCount(5);
    for (const b of await page.locator("#packBtns .lvbtn").all()) await expect(b).toContainText("🔒 Unlock");
    await expect(page.locator("#journeyP")).toHaveText("Start easy and climb. 12 objects, 3 lives.");

    // free rounds use the core objects only: pack objects are part of what is sold
    for (const lv of [1, 2]) {
      await page.locator(`#levelBtns .lvbtn[data-lv="${lv}"]`).click();
      expect(await page.evaluate(lv => G.deck.length === 10 && G.deck.every(o => !o.pack && o.lv === lv), lv)).toBe(true);
      await page.locator("#quitBtn").click();
    }
    // the Journey covers the two free levels, then says so
    await page.locator("#journeyBtn").click();
    for (let i = 0; i < 12; i++) {
      if (i % 6 === 0) await page.locator("#ilGo").click();
      await expect(page.locator("#tot")).toHaveText("12");
      await answerCurrent(page, true);
      await page.locator("#nextBtn").click();
    }
    await expect(page.locator("#endTitle")).toHaveText("Journey complete!");
    await expect(page.locator("#verdict")).toContainText("free half");
    await page.locator("#homeBtn").click();

    // locked things open the unlock screen instead of starting
    for (const sel of ['#levelBtns .lvbtn[data-lv="3"]', '#levelBtns .lvbtn[data-lv="4"]', '#packBtns .lvbtn[data-pack="kitchen"]']) {
      await page.locator(sel).click();
      await expect(page.locator("#unlock")).toBeVisible();
      await page.locator("#unlock [data-home]").click();
    }
    expect(await page.evaluate(() => { startPack("tools"); startLevel(4); return $("unlock").classList.contains("hidden"); })).toBe(false); // not by calling the code either
    await page.locator("#unlock [data-home]").click();

    // the daily object and friend challenges stay free
    await page.locator("#dailyBtn").click();
    await answerCurrent(page, true);
    await page.locator("#quitBtn").click();
    await page.locator("#friendsBtn").click();
    await expect(page.locator("#newChBtn")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("the unlock screen says what you get, shows the store's price, and passes the accessibility audit", async ({ page }) => {
    await openApp(page, { price: "2,99 €" });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator('#levelBtns .lvbtn[data-lv="3"]').click();
    await expect(page.locator("#unlock h2")).toHaveText("Unlock everything");
    await expect(page.locator("#unlockList li")).toHaveText(["Hard and Expert levels", /^All 5 packs: 157 more objects$/, "The full Journey through all four levels"]);
    await expect(page.locator("#unlock")).toContainText("No ads, no subscription");
    await expect(page.locator("#buyBtn")).toHaveText("Unlock for 2,99 €"); // never a price written into the app
    await expect(page.locator("#restoreBtn")).toBeVisible();
    expect((await calls(page, "NativePurchases", "getProduct"))[0].arg).toEqual({ productIdentifier: "unlock_all", productType: "inapp" });
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(r.violations.map(v => v.id)).toEqual([]);
  });

  for (const lang of ["hy", "ru"]) {
    test(`the unlock screen and locked menu fit a 360 px screen in ${lang}`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await page.addInitScript(l => { try { localStorage.setItem("mugnut:lang", JSON.stringify(l)); } catch (e) {} }, lang);
      await openApp(page);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
      expect(await fits()).toBe(true);
      await expect(page.locator("#remindBtn")).toBeVisible();
      await page.locator('#levelBtns .lvbtn[data-lv="3"]').click();
      await expect(page.locator("#unlock")).toBeVisible();
      await expect(page.locator("#buyBtn")).toContainText("$2.99");
      expect(await fits()).toBe(true);
      const text = await page.locator("#unlock").innerText();
      expect(text).not.toMatch(/\{\w+\}|unlock\.|Unlock|Restore/);
    });
  }
});

test.describe("buying and restoring", () => {
  test("a purchase opens everything at once and for good", async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page);
    await page.locator('#packBtns .lvbtn[data-pack="letters"]').click();
    await page.locator("#buyBtn").click();
    await expect(page.locator("#home")).toBeVisible();
    await expect(page.locator("#homeNote")).toHaveText("Unlocked. Thank you! Everything is open.");
    expect((await calls(page, "NativePurchases", "purchaseProduct"))[0].arg).toMatchObject({ productIdentifier: "unlock_all", productType: "inapp", isConsumable: false });
    await expect(page.locator("#levelBtns")).not.toContainText("🔒");
    await expect(page.locator("#packBtns")).not.toContainText("🔒");
    await expect(page.locator("#journeyP")).toContainText("24 objects");
    await page.locator('#packBtns .lvbtn[data-pack="letters"]').click();
    expect(await page.evaluate(() => G.mode === "pack" && G.pack === "letters")).toBe(true);
    await page.locator("#quitBtn").click();
    await page.locator('#levelBtns .lvbtn[data-lv="1"]').click();
    expect(await page.evaluate(() => G.deck.length)).toBe(10);
    await page.locator("#quitBtn").click();
    await page.reload();
    await expect(page.locator("#levelBtns")).not.toContainText("🔒");
    await expect(page.locator("#homeNote")).toBeHidden();
    expect(errors).toEqual([]);
  });

  test("backing out of the payment sheet changes nothing and shows no error", async ({ page }) => {
    await openApp(page, { buy: "cancel" });
    await page.locator('#levelBtns .lvbtn[data-lv="4"]').click();
    await page.locator("#buyBtn").click();
    await expect(page.locator("#buyBtn")).toBeEnabled();
    await expect(page.locator("#unlock")).toBeVisible();
    await expect(page.locator("#unlockNote")).toBeHidden();
    expect(await page.evaluate(() => Store.unlocked())).toBe(false);
  });

  test("a failed payment says so and that nothing was charged; the store being unreachable is its own message", async ({ page }) => {
    await openApp(page, { buy: "fail" });
    await page.locator('#levelBtns .lvbtn[data-lv="4"]').click();
    await page.locator("#buyBtn").click();
    await expect(page.locator("#unlockNote")).toHaveText("The purchase didn't go through. You have not been charged.");
    expect(await page.evaluate(() => Store.unlocked())).toBe(false);
    await page.evaluate(() => { window.__shell.storeDown = true; });
    await page.locator("#buyBtn").click();
    await expect(page.locator("#unlockNote")).toHaveText("Purchases aren't available right now. Check your connection and try again.");
  });

  test("a double tap on Unlock starts one purchase", async ({ page }) => {
    await openApp(page);
    await page.locator('#levelBtns .lvbtn[data-lv="3"]').click();
    await page.evaluate(() => { $("buyBtn").click(); $("buyBtn").click(); $("restoreBtn").click(); });
    await expect(page.locator("#home")).toBeVisible();
    expect(await calls(page, "NativePurchases", "purchaseProduct")).toHaveLength(1);
    expect(await calls(page, "NativePurchases", "restorePurchases")).toHaveLength(0);
  });

  test("restore: nothing found, then found on an account that already paid", async ({ page }) => {
    await openApp(page);
    await page.locator('#levelBtns .lvbtn[data-lv="3"]').click();
    await page.locator("#restoreBtn").click();
    await expect(page.locator("#unlockNote")).toHaveText("No earlier purchase was found for this account.");
    await page.evaluate(() => { window.__shell.owned = true; });
    await page.locator("#restoreBtn").click();
    await expect(page.locator("#home")).toBeVisible();
    await expect(page.locator("#homeNote")).toHaveText("Purchase restored. Everything is open.");
    await expect(page.locator("#levelBtns")).not.toContainText("🔒");
  });

  test("at start the app asks the store: a purchase from another device unlocks, a refund locks again, no answer changes nothing", async ({ page }) => {
    // paid on another device: unlocked without tapping anything
    await openApp(page);
    await expect(page.locator('#levelBtns .lvbtn[data-lv="3"]')).toContainText("🔒");
    await page.evaluate(() => { localStorage.setItem("test:owned", "1"); }); // the fake account now owns it
    await page.reload();
    await expect(page.locator('#levelBtns .lvbtn[data-lv="3"]')).not.toContainText("🔒");
    expect(await page.evaluate(() => localStorage.getItem("mugnut:unlock"))).toBe("1");
    // refunded: the store no longer lists it
    await page.evaluate(() => { localStorage.removeItem("test:owned"); });
    await page.reload();
    await expect(page.locator('#levelBtns .lvbtn[data-lv="3"]')).toContainText("🔒");
    // unlocked, then started with the store unreachable: stays unlocked
    await page.evaluate(() => { localStorage.setItem("mugnut:unlock", "1"); });
    await page.addInitScript(() => { window.__shell.storeDown = true; });
    await page.reload();
    await expect(page.locator("#home")).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.locator('#levelBtns .lvbtn[data-lv="3"]')).not.toContainText("🔒");
  });

  test("a build without the purchase plugin stays honest: locked, and buying says it is unavailable", async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page, { noStore: true });
    await page.locator('#levelBtns .lvbtn[data-lv="3"]').click();
    await expect(page.locator("#buyBtn")).toHaveText("Unlock");
    await page.locator("#buyBtn").click();
    await expect(page.locator("#unlockNote")).toContainText("aren't available right now");
    expect(errors).toEqual([]);
  });

  test("the mock store used for development builds: buy, restore, cancel and fail without any store account", async ({ page }) => {
    await page.addInitScript(() => { window.MUGNUT_MOCK_STORE = true; });
    await openApp(page, { noStore: true });
    await page.locator('#levelBtns .lvbtn[data-lv="3"]').click();
    await expect(page.locator("#buyBtn")).toHaveText("Unlock for $2.99");
    await page.evaluate(() => { window.MUGNUT_MOCK_STORE = "cancel"; });
    await page.locator("#buyBtn").click();
    await expect(page.locator("#unlockNote")).toBeHidden();
    await page.evaluate(() => { window.MUGNUT_MOCK_STORE = "fail"; });
    await page.locator("#buyBtn").click();
    await expect(page.locator("#unlockNote")).toContainText("didn't go through");
    await page.evaluate(() => { window.MUGNUT_MOCK_STORE = true; });
    await page.locator("#buyBtn").click();
    await expect(page.locator("#homeNote")).toContainText("Unlocked");
    // "new phone": the unlock is forgotten, the mock store still has the purchase
    await page.evaluate(() => { localStorage.removeItem("mugnut:unlock"); renderHome(); });
    await page.locator('#levelBtns .lvbtn[data-lv="3"]').click();
    await page.locator("#restoreBtn").click();
    await expect(page.locator("#homeNote")).toContainText("restored");
  });
});

test.describe("native features", () => {
  test("a buzz for a right answer, a different one for a wrong one, none when replaying the locked daily object", async ({ page }) => {
    await page.clock.setFixedTime(new Date(Date.UTC(2026, 10, 12, 6)));
    await openApp(page);
    await page.locator('#levelBtns .lvbtn[data-lv="1"]').click();
    await answerCurrent(page, true);
    await page.locator("#nextBtn").click();
    await answerCurrent(page, false);
    expect((await calls(page, "Haptics")).map(c => c.arg.type)).toEqual(["SUCCESS", "ERROR"]);
    await page.locator("#quitBtn").click();
    await page.locator("#dailyBtn").click();
    await answerCurrent(page, true);
    await page.locator("#quitBtn").click();
    await page.locator("#dailyBtn").click(); // locked: shows the recorded answer
    await expect(page.locator("#fb")).toBeVisible();
    expect(await calls(page, "Haptics")).toHaveLength(3);
  });

  test("Take photo uses the camera, and sharing attaches the photo with a link to the web version", async ({ page }) => {
    const errors = watchErrors(page);
    await stubSharing(page.context());
    await openApp(page);
    await page.locator("#friendsBtn").click();
    await page.locator("#newChBtn").click();
    await page.locator("#camIn").click({ force: true });
    await expect(page.locator("#previewCard")).toBeVisible();
    expect(await calls(page, "Camera", "takePhoto")).toHaveLength(1);
    await page.locator("#chName").fill("Keyring");
    await page.locator('#chOpts .opt[data-g="1"]').click();
    await page.locator("#myName").fill("Alice");
    await page.locator("#postBtn").click();
    await expect(page.locator("#share")).toBeVisible();
    await page.locator("#shShare").click();
    await expect(page.locator("#shErr")).toHaveText("Shared!");
    const [share] = await calls(page, "Share", "share");
    expect(share.arg.files).toEqual(["file:///cache/mugnut-challenge.jpg"]);
    expect(share.arg.text).toContain("Alice challenges you");
    expect(share.arg.text).toMatch(/https:\/\/edhar98\.github\.io\/Mugnut\/#c=[\w-]+\./); // never the app's internal address
    expect(share.arg.text.length).toBeLessThanOrEqual(1000);
    const [file] = await calls(page, "Filesystem", "writeFile");
    expect(file.arg).toMatchObject({ path: "mugnut-challenge.jpg", directory: "CACHE" });
    expect(file.arg.bytes).toBeGreaterThan(10000);

    // closing the share sheet is not an error and does not fall back to copying
    await page.evaluate(() => { window.__shell.share = "cancel"; $("shErr").textContent = ""; });
    await page.locator("#shShare").click();
    await page.waitForTimeout(200);
    await expect(page.locator("#shErr")).toHaveText("");
    // a share sheet that fails falls back to copying the link
    await page.evaluate(() => { window.__shell.share = "fail"; });
    await page.locator("#shShare").click();
    await expect(page.locator("#shErr")).toHaveText("Link copied — paste it into any chat.");
    expect(await lastCopied(page)).toContain("https://edhar98.github.io/Mugnut/#c=");
    expect(errors).toEqual([]);
  });

  test("backing out of the camera leaves the form as it was", async ({ page }) => {
    await openApp(page, { camera: "cancel" });
    await page.locator("#friendsBtn").click();
    await page.locator("#newChBtn").click();
    await page.locator("#camIn").click({ force: true });
    await page.waitForTimeout(200);
    await expect(page.locator("#previewCard")).toBeHidden();
    await expect(page.locator("#photoBtns")).toBeVisible();
    await expect(page.locator("#chErr")).toHaveText("");
  });

  test("sharing the daily result goes through the share sheet and never names the object", async ({ page }) => {
    await openApp(page);
    await page.locator("#dailyBtn").click();
    const o = await page.evaluate(() => ({ name: G.deck[0].name, shape: SHAPES[G.deck[0].g] }));
    await answerCurrent(page, true);
    await page.locator("#nextBtn").click();
    await page.locator("#againBtn").click();
    await expect(page.locator("#verdict")).toHaveText("Shared!");
    const [share] = await calls(page, "Share", "share");
    expect(share.arg.text).toContain("https://edhar98.github.io/Mugnut/");
    expect(share.arg.text.toLowerCase()).not.toContain(o.name.toLowerCase());
    expect(share.arg.text.toLowerCase()).not.toContain(o.shape.toLowerCase());
  });

  test("the daily reminder is opt-in, set for 9:00, says nothing about the object, and can be switched off", async ({ page }) => {
    await openApp(page);
    await expect(page.locator("#remindBtn")).toHaveText("Remind me each day");
    await expect(page.locator("#remindBtn")).toHaveAttribute("aria-pressed", "false");
    expect(await calls(page, "LocalNotifications")).toEqual([]); // nothing is asked or scheduled until the player chooses
    await page.locator("#remindBtn").click();
    await expect(page.locator("#remindBtn")).toHaveText("Daily reminder on · 9:00");
    await expect(page.locator("#remindBtn")).toHaveAttribute("aria-pressed", "true");
    const [sched] = await calls(page, "LocalNotifications", "schedule");
    expect(sched.arg.notifications).toHaveLength(1);
    expect(sched.arg.notifications[0]).toMatchObject({ title: "Mugnut", body: "Today's object is waiting. How many holes?", schedule: { on: { hour: 9, minute: 0 } } });
    const today = await page.evaluate(() => dailyObject().name);
    expect(sched.arg.notifications[0].body).not.toContain(today);
    await page.reload();
    await expect(page.locator("#remindBtn")).toHaveText("Daily reminder on · 9:00");
    await page.locator("#remindBtn").click();
    await expect(page.locator("#remindBtn")).toHaveText("Remind me each day");
    expect((await calls(page, "LocalNotifications", "cancel")).length).toBeGreaterThan(0);
    expect(await calls(page, "LocalNotifications", "schedule")).toHaveLength(0); // since the reload
  });

  test("if notifications are refused the switch stays off and says why", async ({ page }) => {
    await openApp(page, { permission: "denied" });
    await page.locator("#remindBtn").click();
    await expect(page.locator("#remindBtn")).toHaveText("Remind me each day");
    await expect(page.locator("#homeNote")).toContainText("switched off in your phone's settings");
    expect(await calls(page, "LocalNotifications", "schedule")).toHaveLength(0);
  });

  test("a challenge link that opens the app is played in the app; hostile links are still rejected", async ({ page, browser }, testInfo) => {
    // Alice makes a challenge on the web
    const ctx = await newPhone(browser, testInfo);
    const alice = await ctx.newPage();
    await alice.goto("./");
    await alice.locator("#friendsBtn").click();
    await alice.locator("#newChBtn").click();
    await alice.locator("#galIn").setInputFiles(PHOTO);
    await expect(alice.locator("#previewCard")).toBeVisible();
    await alice.locator("#chName").fill("Keyring");
    await alice.locator('#chOpts .opt[data-g="1"]').click();
    await alice.locator("#myName").fill("Alice");
    await alice.locator("#postBtn").click();
    await alice.locator("#shCopy").click();
    const link = (await lastCopied(alice)).split("\n").pop().replace(/^https?:\/\/[^/]+\//, "https://edhar98.github.io/Mugnut/");
    await ctx.close();

    const errors = watchErrors(page);
    await openApp(page);
    await page.evaluate(url => window.__open(url), link);
    await expect(page.locator("#play")).toBeVisible();
    await expect(page.locator("#plName")).toHaveText("Keyring");
    await page.locator('#plOpts .opt[data-g="1"]').click();
    await expect(page.locator("#plFbTitle")).toContainText("Correct");
    await page.locator("#playBack").click();
    await page.evaluate(() => window.__open("https://edhar98.github.io/Mugnut/#c=%%%broken"));
    await expect(page.locator("#fNote")).toContainText("broken or incomplete");
    await page.evaluate(() => { window.__open("https://edhar98.github.io/Mugnut/"); window.__open("mugnut://anything"); }); // nothing to do, nothing breaks
    expect(errors.filter(e => !/Failed to execute 'atob'|InvalidCharacterError|URIError|malformed/i.test(e))).toEqual([]);
  });

  test("a link that launched the app is opened once it starts", async ({ page }) => {
    const meta = { v: 1, id: "launch1", n: "Paperclip", t: "", f: "Alice", k: 2, at: 1 };
    const b64u = s => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    await page.addInitScript(...shell({ launch: "https://edhar98.github.io/Mugnut/#c=" + b64u(JSON.stringify(meta)) + "." }));
    await page.goto("./");
    await expect(page.locator("#play")).toBeVisible();
    await expect(page.locator("#plName")).toHaveText("Paperclip");
  });

  test("inside the app no service worker is registered and nothing is counted", async ({ page }) => {
    await openApp(page);
    await page.locator('#levelBtns .lvbtn[data-lv="1"]').click();
    await answerCurrent(page, true);
    expect(await page.evaluate(() => window.__hits)).toEqual([]);
    const src = await page.evaluate(() => document.documentElement.outerHTML);
    expect(src).toContain("!NATIVE && \"serviceWorker\" in navigator");
  });
});

test.describe("the app build", () => {
  const { execFileSync } = require("child_process");
  const root = path.resolve(__dirname, "..");
  const build = (...args) => execFileSync("node", ["tools/build-web.js", "--out=" + path.join(root, "test-results", "dist-" + (args[0] || "store").replace(/\W/g, "")), ...args], { cwd: root, encoding: "utf8" });

  test("dist has every file the page loads, Capacitor's core before native.js, and no service worker", async () => {
    const out = path.join(root, "test-results", "dist-store");
    build();
    const html = fs.readFileSync(path.join(out, "index.html"), "utf8");
    const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
    for (const s of scripts) expect(fs.existsSync(path.join(out, s)), s).toBe(true);
    expect(scripts.indexOf("capacitor.js")).toBe(scripts.indexOf("native.js") - 1);
    for (const f of ["lang/hy.js", "lang/ru.js", "icons/icon-192.png", "manifest.webmanifest"]) expect(fs.existsSync(path.join(out, f)), f).toBe(true);
    expect(fs.existsSync(path.join(out, "sw.js"))).toBe(false);
    expect(html).not.toContain("MUGNUT_MOCK_STORE = true"); // a store build never simulates purchases
    expect(fs.readFileSync(path.join(out, "capacitor.js"), "utf8")).toContain("registerPlugin");
    // the web version itself does not load Capacitor
    expect(fs.readFileSync(path.join(root, "index.html"), "utf8")).not.toContain("capacitor.js");
  });

  test("a development build switches the mock store on, before native.js reads it", async () => {
    const out = path.join(root, "test-results", "dist-mockstore");
    expect(build("--mock-store")).toContain("do not submit");
    const html = fs.readFileSync(path.join(out, "index.html"), "utf8");
    expect(html.indexOf("window.MUGNUT_MOCK_STORE = true")).toBeGreaterThan(0);
    expect(html.indexOf("window.MUGNUT_MOCK_STORE = true")).toBeLessThan(html.indexOf('<script src="native.js">'));
  });

  test("with Capacitor's real core script, plugins are obtained by registering them", async ({ page }) => {
    // Capacitor's own core, as the app loads it, on top of a minimal stand-in for the native side.
    const core = fs.readFileSync(path.join(root, "node_modules/@capacitor/core/dist/capacitor.js"), "utf8");
    await page.addInitScript(() => {
      window.__native = [];
      const headers = ["Haptics", "Share", "App", "LocalNotifications", "Filesystem", "Camera"].map(name => ({ name, methods: ["notification", "share", "addListener", "getLaunchUrl", "cancel", "schedule", "requestPermissions", "writeFile", "takePhoto"].map(m => ({ name: m, rtype: "promise" })) }));
      window.Capacitor = { PluginHeaders: headers, Plugins: {}, isNativePlatform: () => true, nativePromise: (plugin, method, options) => { window.__native.push([plugin, method, options]); return Promise.resolve({}); }, nativeCallback: () => "cb1" };
      window.androidBridge = { postMessage() {} };
    });
    // served the way the app build lays it out: capacitor.js as its own script, just before native.js
    await page.route("**/capacitor.js", r => r.fulfill({ contentType: "text/javascript", body: core }));
    await page.route(url => /\/(index\.html)?$/.test(url.pathname), r => r.fulfill({ contentType: "text/html", body: fs.readFileSync(path.join(root, "index.html"), "utf8").replace('<script src="native.js"></script>', '<script src="capacitor.js"></script>\n<script src="native.js"></script>') }));
    await page.goto("./");
    await expect(page.locator("#home")).toBeVisible();
    expect(await page.evaluate(() => [NATIVE, typeof capacitorExports.registerPlugin, Capacitor.getPlatform()])).toEqual([true, "function", "android"]);
    await page.locator('#levelBtns .lvbtn[data-lv="1"]').click();
    await answerCurrent(page, true);
    await expect.poll(() => page.evaluate(() => window.__native.filter(c => c[0] === "Haptics"))).toEqual([["Haptics", "notification", { type: "SUCCESS" }]]);
    // the purchase plugin is not among this shell's plugins: the store reports itself unavailable instead of throwing
    expect(await page.evaluate(() => Store.buy())).toBe("unavailable");
    expect(await page.evaluate(() => Store.price())).toBeNull();
  });
});

test.describe("what the stores really send (shapes taken from the plugin's native code)", () => {
  test("Android: backing out is a cancellation, not a failure", async ({ page }) => {
    await openApp(page, { platform: "android", buy: "cancel" });
    await page.locator('#levelBtns .lvbtn[data-lv="4"]').click();
    await page.locator("#buyBtn").click();
    await expect(page.locator("#buyBtn")).toBeEnabled();
    await expect(page.locator("#unlockNote")).toBeHidden();
    expect(await page.evaluate(() => Store.unlocked())).toBe(false);
  });

  test("Android: a purchase is acknowledged before it counts, and again at start if that was missed", async ({ page }) => {
    await openApp(page, { platform: "android" });
    await page.locator('#levelBtns .lvbtn[data-lv="4"]').click();
    await page.locator("#buyBtn").click();
    await expect(page.locator("#homeNote")).toContainText("Unlocked");
    expect((await calls(page, "NativePurchases", "acknowledgePurchase")).map(c => c.arg)).toEqual([{ purchaseToken: "tok1" }]);
    // next launch: the store still shows it as unacknowledged (the first attempt was lost), so it is acknowledged again
    await page.reload();
    await expect(page.locator("#home")).toBeVisible();
    await expect.poll(async () => (await calls(page, "NativePurchases", "acknowledgePurchase")).length).toBe(1);
    await expect(page.locator('#levelBtns .lvbtn[data-lv="4"]')).not.toContainText("🔒");
  });

  test("iOS: nothing to acknowledge", async ({ page }) => {
    await openApp(page);
    await page.locator('#levelBtns .lvbtn[data-lv="4"]').click();
    await page.locator("#buyBtn").click();
    await expect(page.locator("#homeNote")).toContainText("Unlocked");
    expect(await calls(page, "NativePurchases", "acknowledgePurchase")).toEqual([]);
  });

  test("a payment still waiting (cash, voucher, Ask to Buy) does not unlock, and says so", async ({ page }) => {
    await openApp(page, { platform: "android", buy: "pending" });
    await page.locator('#levelBtns .lvbtn[data-lv="4"]').click();
    await page.locator("#buyBtn").click();
    await expect(page.locator("#unlockNote")).toContainText("waiting for approval or payment");
    expect(await page.evaluate(() => Store.unlocked())).toBe(false);
    // the store lists the unpaid purchase at the next start: still locked
    await page.addInitScript(() => { window.__shell.pending = true; });
    await page.reload();
    await expect(page.locator("#home")).toBeVisible();
    await page.waitForTimeout(200);
    await expect(page.locator('#levelBtns .lvbtn[data-lv="4"]')).toContainText("🔒");
    // iOS Ask to Buy
    await page.evaluate(() => { window.__shell.buy = "ask"; window.__shell.platform = "ios"; });
    await page.locator('#levelBtns .lvbtn[data-lv="4"]').click();
    await page.locator("#buyBtn").click();
    await expect(page.locator("#unlockNote")).toContainText("waiting for approval or payment");
  });

  test("Android: tapping Unlock when the account already owns it just opens the game", async ({ page }) => {
    await openApp(page, { platform: "android", buy: "owned", storeDown: true }); // the check at start could not reach the store
    await expect(page.locator('#levelBtns .lvbtn[data-lv="4"]')).toContainText("🔒");
    await page.evaluate(() => { window.__shell.storeDown = false; });
    await page.locator('#levelBtns .lvbtn[data-lv="4"]').click();
    await page.locator("#buyBtn").click();
    await expect(page.locator("#homeNote")).toContainText("Unlocked");
    await expect(page.locator('#levelBtns .lvbtn[data-lv="4"]')).not.toContainText("🔒");
  });

  test("a slow answer from the store at start cannot undo a purchase made meanwhile", async ({ page }) => {
    await openApp(page, { platform: "android", slow: 1500 }); // the start-up question is still in the air
    await page.locator('#levelBtns .lvbtn[data-lv="4"]').click();
    await page.evaluate(() => { window.__shell.slow = 0; });
    await page.locator("#buyBtn").click();
    await expect(page.locator("#homeNote")).toContainText("Unlocked", { timeout: 10000 });
    await page.waitForTimeout(1800); // the stale "owns nothing" answer has arrived by now
    expect(await page.evaluate(() => [Store.unlocked(), localStorage.getItem("mugnut:unlock")])).toEqual([true, "1"]);
    await page.locator('#levelBtns .lvbtn[data-lv="4"]').click();
    await expect(page.locator("#lvChip")).toHaveText("Expert");
  });

  test("store calls never overlap (the Android plugin has one billing connection)", async ({ page }) => {
    await page.addInitScript(() => { window.__active = 0; window.__maxActive = 0; });
    await openApp(page, { platform: "android" });
    await page.evaluate(() => {
      const p = Capacitor.Plugins.NativePurchases;
      for (const m of ["getProduct", "getPurchases", "purchaseProduct", "restorePurchases"]) { const f = p[m]; p[m] = async o => { window.__active++; window.__maxActive = Math.max(window.__maxActive, window.__active); await new Promise(r => setTimeout(r, 40)); try { return await f(o); } finally { window.__active--; } }; }
    });
    await page.evaluate(() => Promise.all([Store.refresh(), Store.price(), Store.restore(), Store.price(), Store.refresh()]));
    expect(await page.evaluate(() => window.__maxActive)).toBe(1);
  });

  test("Android back button: back to the menu from a screen, and out of the way on the menu", async ({ page }) => {
    await openApp(page, { platform: "android" });
    await page.locator('#levelBtns .lvbtn[data-lv="1"]').click();
    await expect(page.locator("#game")).toBeVisible();
    await page.evaluate(() => window.__back());
    await expect(page.locator("#home")).toBeVisible();
    expect(await calls(page, "App", "minimizeApp")).toHaveLength(0);
    await page.evaluate(() => window.__back());
    expect(await calls(page, "App", "minimizeApp")).toHaveLength(1);
  });
});

test.describe("the website can never turn into the app", () => {
  test("on the real web address a Capacitor object changes nothing: no paywall, analytics still on", async ({ page, context }) => {
    // the site opened inside some other app's shell, which injects its own bridge
    await context.route("https://edhar98.github.io/**", route => {
      const rel = new URL(route.request().url()).pathname.replace(/^\/Mugnut\//, "") || "index.html", file = path.join(path.resolve(__dirname, ".."), rel);
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
      route.fulfill({ status: 200, contentType: { ".html": "text/html", ".js": "text/javascript", ".png": "image/png" }[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
    });
    await page.addInitScript(...shell());
    await page.goto("https://edhar98.github.io/Mugnut/");
    await expect(page.locator("#home")).toBeVisible();
    expect(await page.evaluate(() => [NATIVE, Store.paywall, isLocked()])).toEqual([false, false, false]);
    await expect(page.locator("#levelBtns")).not.toContainText("🔒");
    await expect(page.locator("#remindRow")).toBeHidden();
    expect((await page.evaluate(() => window.__hits)).length).toBe(1); // the web page view is still counted
  });

  test("if native.js fails to load, the page says so and offers a reload", async ({ page }) => {
    await page.route("**/native.js", r => r.abort());
    await page.goto("./");
    await expect(page.getByText("did not finish loading")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
    await expect(page.locator("#journeyBtn")).toHaveCount(0);
  });

  test("inside the app the counter is off even if the page were served from the live address", async ({ page }) => {
    await openApp(page);
    expect(await page.evaluate(() => { const before = window.__hits.length; ANALYTICS_HOSTS.push(location.hostname); track("/"); track("round-start-journey"); return window.__hits.length - before; })).toBe(0);
  });
});
