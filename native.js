// Mugnut inside the native app shell (Capacitor): sharing with a photo, the camera, haptics, the daily reminder,
// links that open the app, and the one-time unlock. On the web NATIVE is false and nothing here does anything,
// so the web version behaves exactly as it does without this file.
//
// No bundler, no imports: the app build (tools/build-web.js) loads Capacitor's own core script, capacitor.js, before
// this file; it defines capacitorExports.registerPlugin, which hands out the plugin objects used below.
// Every call is guarded: a missing plugin or a failed call must never break the game.

const NATIVE = (() => { try { return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()); } catch (e) { return false; } })();
// Inside the app the page lives at an internal address, so links people share always point at the web version.
const PUBLIC_URL = "https://edhar98.github.io/Mugnut/";

// One plugin object per name: an already registered one, else a fresh registration with Capacitor's core.
const capPlugin = name => {
  try {
    if (!NATIVE) return null;
    const have = Capacitor.Plugins && Capacitor.Plugins[name]; if (have) return have;
    if (Capacitor.isPluginAvailable && !Capacitor.isPluginAvailable(name)) return null;   // not built into this app
    const core = window.capacitorExports;
    return core && typeof core.registerPlugin === "function" ? core.registerPlugin(name) : null;
  } catch (e) { return null; }
};

const Native = (() => {
  const plug = capPlugin;
  const aborted = () => Object.assign(new Error("cancelled"), { name: "AbortError" });
  const toBase64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] || ""); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  const REMINDER_ID = 1, REMINDER_KEY = "mugnut:reminder";

  return {
    // a short buzz: "good" / "bad" after an answer
    haptic(kind) {
      const h = plug("Haptics"); if (!h) return;
      try { Promise.resolve(h.notification({ type: kind === "good" ? "SUCCESS" : "ERROR" })).catch(() => {}); } catch (e) {}
    },

    // The system share sheet, with the photo attached when there is one.
    // Resolves when shared; rejects with an AbortError if the player closed the sheet, or another error if sharing is impossible.
    async share({ text, file }) {
      const share = plug("Share"); if (!share) throw new Error("no share plugin");
      const opts = { text };
      const fs = plug("Filesystem");
      if (file && fs) {
        try {
          const saved = await fs.writeFile({ path: "mugnut-challenge.jpg", data: await toBase64(file), directory: "CACHE" });
          if (saved && saved.uri) opts.files = [saved.uri];
        } catch (e) { /* share the text and link alone */ }
      }
      try { await share.share(opts); }
      catch (e) { if (/cancel/i.test(String(e && e.message))) throw aborted(); throw e; }
    },

    // The camera. Resolves with the photo as a Blob, or null if the player backed out or it is unavailable.
    async takePhoto() {
      const cam = plug("Camera"); if (!cam) return null;
      try {
        const shot = await cam.takePhoto({ quality: 85, targetWidth: 1600, targetHeight: 1600, correctOrientation: true });
        const src = shot && (shot.webPath || shot.uri); if (!src) return null;
        return await (await fetch(src)).blob();
      } catch (e) { return null; }
    },

    // The daily reminder: one local notification a day, only if the player turns it on. Nothing is sent anywhere.
    reminder: {
      available: () => !!plug("LocalNotifications"),
      on: () => { try { return localStorage.getItem(REMINDER_KEY) === "1"; } catch (e) { return false; } },
      // title and body are passed in so they are in the player's language and never name the object
      async set(on, { title, body } = {}) {
        const ln = plug("LocalNotifications"); if (!ln) return false;
        try {
          await ln.cancel({ notifications: [{ id: REMINDER_ID }] }).catch(() => {});
          if (on) {
            const perm = await ln.requestPermissions();
            if (!perm || perm.display !== "granted") { localStorage.removeItem(REMINDER_KEY); return false; }
            await ln.schedule({ notifications: [{ id: REMINDER_ID, title, body, schedule: { on: { hour: 9, minute: 0 }, allowWhileIdle: true } }] });
            localStorage.setItem(REMINDER_KEY, "1");
            return true;
          }
          localStorage.removeItem(REMINDER_KEY);
          return false;
        } catch (e) { return Native.reminder.on(); }
      },
    },

    // Links that open the app (a challenge or an answer): the address is handed to `open`, which treats it as untrusted.
    onLink(open) {
      const app = plug("App"); if (!app) return;
      try {
        app.addListener("appUrlOpen", e => { if (e && typeof e.url === "string") open(e.url); });
        Promise.resolve(app.getLaunchUrl()).then(u => { if (u && typeof u.url === "string") open(u.url); }).catch(() => {});
      } catch (e) {}
    },
  };
})();

// ---------- the one-time unlock ----------
// Free: Easy, Medium, the daily object and friend challenges. One purchase (never a subscription) unlocks Hard, Expert
// and every pack. The paywall exists only inside the native apps; the web version stays fully open.
//
// Store is the only thing the game talks to:
//   Store.paywall            is there a paywall at all (native apps only)
//   Store.unlocked()         has this device's player bought it (remembered on the device, re-checked with the store)
//   Store.price()            -> "$2.99" in the player's currency, or null if the store cannot be reached
//   Store.buy()              -> "ok" | "cancelled" | "failed" | "unavailable"
//   Store.restore()          -> true if a past purchase was found
//   Store.refresh()          ask the store what this account owns (call once at start)
// Two back ends: the real one (the NativePurchases plugin: StoreKit on iOS, Play Billing on Android) and a mock for
// development builds and tests, switched on by window.MUGNUT_MOCK_STORE = true before this script runs.
const UNLOCK_PRODUCT = "unlock_all";
const Store = (() => {
  const KEY = "mugnut:unlock";
  const remembered = () => { try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; } };
  const remember = yes => { try { yes ? localStorage.setItem(KEY, "1") : localStorage.removeItem(KEY); } catch (e) {} };
  const plugin = () => capPlugin("NativePurchases");
  const owns = list => Array.isArray(list) && list.some(p => p && p.productIdentifier === UNLOCK_PRODUCT);

  const real = {
    async price() {
      const p = plugin(); if (!p) return null;
      try { const r = await p.getProduct({ productIdentifier: UNLOCK_PRODUCT, productType: "inapp" }); return (r && r.product && r.product.priceString) || null; } catch (e) { return null; }
    },
    async buy() {
      const p = plugin(); if (!p) return "unavailable";
      try {
        const ok = await p.isBillingSupported().catch(() => ({ isBillingSupported: true }));
        if (ok && ok.isBillingSupported === false) return "unavailable";
        const tx = await p.purchaseProduct({ productIdentifier: UNLOCK_PRODUCT, productType: "inapp", quantity: 1, isConsumable: false });
        if (tx && tx.productIdentifier === UNLOCK_PRODUCT) { remember(true); return "ok"; }
        return "failed";
      } catch (e) { return /cancel/i.test(String(e && (e.message || e.code))) ? "cancelled" : "failed"; }
    },
    // what the store says this account owns; null when it cannot be asked (offline): then the remembered answer stands
    async owned() {
      const p = plugin(); if (!p) return null;
      try { const r = await p.getPurchases({ productType: "inapp", onlyCurrentEntitlements: true }); return owns(r && r.purchases); } catch (e) { return null; }
    },
    async restore() {
      const p = plugin(); if (!p) return false;
      try { await p.restorePurchases(); } catch (e) { return false; }
      const has = await real.owned();
      if (has === true) remember(true);
      return has === true;
    },
  };

  // The mock keeps "the store's" record under its own key, so restore can be tried after clearing the unlock.
  const MOCK_KEY = "mugnut:mock-store-owned";
  const mock = {
    async price() { return "$2.99"; },
    async buy() { const how = window.MUGNUT_MOCK_STORE; if (how === "cancel") return "cancelled"; if (how === "fail") return "failed"; try { localStorage.setItem(MOCK_KEY, "1"); } catch (e) {} remember(true); return "ok"; },
    async owned() { try { return localStorage.getItem(MOCK_KEY) === "1"; } catch (e) { return null; } },
    async restore() { const has = await mock.owned(); if (has) remember(true); return !!has; },
  };

  const back = () => (window.MUGNUT_MOCK_STORE ? mock : real);
  return {
    get paywall() { return NATIVE; },
    unlocked: () => !NATIVE || remembered(),
    price: () => back().price(),
    buy: () => back().buy(),
    restore: () => back().restore(),
    // A refund or a purchase made on another device shows up here. Only a definite answer changes anything.
    async refresh() { if (!NATIVE) return; const has = await back().owned(); if (has === true) remember(true); else if (has === false) remember(false); },
  };
})();
