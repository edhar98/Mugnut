# Mugnut — progress

Updated: 2026-11-11

## Where things stand
- **Live on the web:** https://edhar98.github.io/Mugnut/ with everything from Phases 0–3 that affects the web: 257 objects, daily mode with archive, hole highlighting, Armenian and Russian, accessibility, anonymous counting.
- **Phone apps:** the projects, native features and one-time unlock are written and merged, but **nothing has been compiled or run**. That needs Xcode and Android Studio on this Mac.
- **Next:** the human's Gate 3 steps in `HUMAN_TODO.md`; then building and correcting the apps on a simulator and emulator. Phase 4 (launch posts, metrics checklist) is not started.
- **Tests:** 303 passed, 7 skipped locally; 229 passed, 9 skipped for the web tests run against the live site.
- All work went through pull requests #1–#8, each reviewed by an agent that did not write it, then checked on the live site after merging.

## Done

### Phase 0 — Setup
- Independent review of `daily-mode`: changes requested, fixed, then approved.
- Merged to `main` as [edhar98/Mugnut#1](https://github.com/edhar98/Mugnut/pull/1) (merge commit `fc1fce4`); the live site was checked afterwards by running the whole suite against it: 54 passed.
- `MUGNUT_URL=<url> npx playwright test` runs the suite against a deployed copy.
- Git repository connected to `edhar98/Mugnut`; daily mode, result sharing and Open Graph tags committed on `daily-mode`.
- `package.json` (dev dependencies only: Playwright, http-server) and `.gitignore` (tooling output, secrets, signing material).
- Playwright smoke suite in `tests/`, run at two phone profiles (Pixel 7 / Chromium, iPhone 14 / WebKit): 27 tests each (54 total), also green with the runner in UTC and US Pacific time.
  - `data.spec.js`: `OBJECTS` integrity (100 objects, 25 per level, genus 0–5, unique names, every drawing is well-formed SVG), daily object defined for every day.
  - `game.spec.js`: home, assets, full Easy round, Journey losing 3 lives, flawless Journey, quit, opening `index.html` from the file system.
  - `daily.spec.js`: play, lock, streak across days, daylight-saving changes, answering across midnight, same object for everyone, share text does not reveal the answer.
  - `friends.spec.js`: create a challenge with a fixture photo, open the link on a second phone, answer, open the reply on the first; pasted links; hostile and broken links.
- `tools/render-object.js` renders any object's drawing to PNG for visual checks.
- Bugs found by the suite and fixed:
  - **Challenge links created in Safari opened as "broken" for the friend.** Safari cannot encode WebP, no JPEG preview fits a 1,000-character caption, so the link carried no preview and the reader rejected it. A link without a preview now opens with the "photo is in your chat" placeholder.
  - A challenge link with a non-numeric answer key was stored and crashed on reveal; it is now rejected as broken.
  - Found by the independent review and fixed: a fractional answer in a link was stored and broke the Friends hub for good; ids such as `__proto__` or `constructor` in a link reached built-in objects; the daily streak reset around daylight-saving changes; an object opened before midnight and answered after it was recorded against the next day; "Share result" did nothing where neither sharing nor the clipboard is available.
  - "Plus-shaped pipe" drew stray lines across its joint (a duplicate `stroke` attribute that was also invalid SVG).

### Phase 1 — Validation features (web)
Each item was built on its own branch, reviewed by an agent that did not write it, and checked on the live site after merging.

- **Build stamp** ([#2](https://github.com/edhar98/Mugnut/pull/2), merged): the offline cache is named after a hash of the shipped files, written by `tools/stamp.js`; a pre-commit hook, a test and a GitHub Action keep it current. Offline play is tested with the service worker on.
- **Analytics** ([#3](https://github.com/edhar98/Mugnut/pull/3), merged): GoatCounter, site code `mugnut`, behind `ANALYTICS` in `index.html` (`""` switches it off). No third-party script, no cookies. Sends a page view and fixed event names, the screen width and the referring site's host name; only from the live host; nothing under Do Not Track / Global Privacy Control. The review caught the first version forwarding the full referring address, which could contain a challenge link; fixed before merge, with a test that reproduces it. README has a Privacy section stating exactly what is sent.
- **Daily archive, countdown, pinned rotation** ([#4](https://github.com/edhar98/Mugnut/pull/4), merged): "Past objects" lists earlier days and lets a missed one be played once without touching the streak; the menu and result screen count down to the next object; the rotation uses a fixed pool of the first 100 objects, so new objects never change past or future days. The share text never reveals the answer.
- **Open Graph image** ([#5](https://github.com/edhar98/Mugnut/pull/5), merged): `og.png`, 1200×630, rendered from the game's own art by `tools/make-og.js`.
- **Photos in IndexedDB** ([#6](https://github.com/edhar98/Mugnut/pull/6), merged): sharp photos moved out of `localStorage` with a one-time background migration; broken records from old malformed links are cleaned up; link previews and the number of received challenges are capped; service worker hardening.

Suite: 135 passed, 3 skipped (offline emulation with a service worker is Chromium-only), on Pixel 7 / Chromium and iPhone 14 / WebKit. Against the live site after the last merge: 133 passed, 5 skipped.

### Phase 2 — Depth (web)
Merged as [#7](https://github.com/edhar98/Mugnut/pull/7) after independent review (changes requested, fixed, approved) and verified on the live site (229 passed, 9 skipped against it).

- **Content: 257 objects** (100 core + 157 in five packs: Kitchen 35, Clothing 30, Tools 35, Letters & digits 38 with Latin and Armenian, Controversies 19). Pipeline per pack: an author proposed objects with a physical description; a reviewer who never saw the answers re-derived every genus from the description; an illustrator drew each one and checked renders. **The blind reviews agreed with the authors on all 166 proposals; no genus was disputed.** Nine proposals were dropped by the orchestrator (contrived, undrawable, brand-like, duplicate, or font-dependent: Toaster, Coffee dripper, Fuel can, Cable tie, Foam clog, Jeans with belt loops, a second Apron, a second Letter B, Armenian Ց).
- **Code structure**: drawing helpers and core objects live in `objects.js`, packs in `packs/*.js` (plain scripts; the game still runs from a file). Pack rounds on the menu with their own best scores.
- **Hole highlighting**: every object carries `holes` / `open` coordinates; after an answer the picture shows a solid ring on each through-hole and a dashed ring on each opening into a shared space, with a one-line legend ("4 openings into one space, which make 3 holes"). A test checks that the marks of all 257 objects add up to their answers.
- **Localisation**: all interface strings in a table (`STR`, `t()`), Armenian and Russian in `lang/hy.js` / `lang/ru.js` loaded on demand, language picker on the menu, all 257 objects translated (name, qualifier, explanation). Every screen is tested at 360 px in both languages for overflow, clipping, raw keys and leftover English.
- **Accessibility**: automated WCAG 2.1 A/AA audit (axe) of every screen in three languages; colours darkened to pass contrast; focus moves with the action and has a visible ring; option buttons and lives are labelled for screen readers and right/wrong is not told by colour alone; tap targets are at least 44 px; no animation under reduced motion.
- Not built: the **Beyond genus** pack (Möbius strip, Klein bottle, knots). The human decided at Gate 2 to skip it.

Suite: 231 passed, 7 skipped, on Pixel 7 / Chromium and iPhone 14 / WebKit.

### Phase 3 — Native apps
Merged as [#8](https://github.com/edhar98/Mugnut/pull/8); the web version was verified on the live site afterwards (229 passed, 9 skipped, web tests only).

**Not compiled or run yet: this Mac has no Xcode, Java or Android SDK.** Everything below was verified in the browser against a stand-in for the app shell, and once against Capacitor's real core script; none of it has touched StoreKit, Play Billing or a real device.

- **Capacitor 8** projects in `ios/` (Swift packages, no CocoaPods) and `android/`, app id `app.mugnut.game`, portrait only, icons and launch images generated from the game's icon by `tools/make-app-icons.js`.
- `tools/build-web.js` copies the root web files to `dist/` (Capacitor's `webDir`), adds Capacitor's core script, and leaves the service worker out. `npm run cap:sync` for store builds, `npm run cap:sync:mock` for builds with a simulated store.
- `native.js`: on the web it does nothing. In the apps: share sheet with the photo attached, the camera for "Take photo", a buzz on right and wrong answers, an opt-in daily reminder at 9:00 (a local notification, no server), links that open the app, no service worker, no analytics.
- **One-time unlock** behind a `Store` interface with a real back end (the NativePurchases plugin: StoreKit / Play Billing, product `unlock_all`) and a mock. Free in the apps: Easy and Medium (core objects), the daily object, friend challenges, a 12-object Journey. Paid: Hard, Expert, all packs, the full Journey. Includes "Restore purchases"; refunds and purchases from another device are picked up at start. The web version has no paywall.
- **Store assets**: `store/icon-1024.png`, `store/feature-1024x500.png`, `store/listing.md` (English, Armenian, Russian), screenshots for iPhone 6.9", iPad 13" and Android phones in three languages via `tools/make-store-shots.js` (taken from the game code in a browser at device size, not from devices), and `privacy.html`.
- Gate 3 checklist (tools to install, accounts, products, signing, app links, submission) is in `HUMAN_TODO.md`.

Suite: 303 passed, 7 skipped. Independent review: changes requested (web load guard; Android purchase states, acknowledgement and a relock race found by reading the plugin's source), fixed, approved.

### Phase 4 — Launch support
Not started (launch post drafts, a short video script, the metrics checklist).

## In progress
- Nothing. Waiting at Gate 3: the build tools must be installed before the apps can be compiled, run and corrected.

## Blocked on the human
- Install Xcode and Android Studio; create the developer accounts; decide the app id and the app-links route. See `HUMAN_TODO.md`.

## Backlog notes
- **Before any store build:** give every store call except the purchase itself a timeout (`native.js`, the `serial` queue). Today a store request that never answers leaves the Unlock and Restore buttons waiting until the app is restarted. Suggested: price 10 s, owned-check 15 s, restore 20 s, acknowledge 10 s.
- Phase 3 review notes still open: a "waiting for approval" purchase is only picked up at the next start; nothing but a console line stops a mock-store build being submitted (always run `npm run cap:sync` for store builds).
- Service worker: fetches are network-first with no timeout, so on a connection that stalls (rather than fails) the menu can sit without working buttons until the browser gives up. Add one timeout covering the page and its scripts together.
- A player whose browser is set to Armenian or Russian waits for the language file (about 70 KB) before the first screen appears.
- Screen readers may not announce the answer reliably (the status region is filled while hidden, then focus moves); use a separate always-present live region.
- Levels and Journey now draw from all 257 objects, packs included (intended, for variety). The daily object still uses only the core 100.
- Small follow-ups from the last review, none affecting stored data: the share card right after creating a challenge shows the link preview rather than the sharp photo; "Share again" can wait several seconds if IndexedDB hangs; the "See it sharp" label can show wrongly if two challenges are opened within milliseconds; `tools/make-og.js` uses Apple system fonts, so regenerate `og.png` on a Mac.
- The GitHub Action only checks the build stamp; it does not run the Playwright suite.
- New objects go in a pack file; the first 100 entries of `objects.js` are the daily rotation and must not be reordered, removed or edited (a test holds a fingerprint of them).
- The apps send no analytics at all (the privacy policy says so). Conversion from free to paid is therefore visible only in the stores' own sales reports.
- The upgrade from one deployed version to the next is tested for the page and its scripts arriving together; the one-time upgrade from the oldest single-file version was checked by hand by a reviewer.
- Challenges created in Safari travel without an in-link preview (JPEG headers alone exceed the caption budget). The attached photo still goes through the share sheet. The apps' share sheet attaches the photo itself; a smaller hand-rolled preview format would fix it on the web.
- Not reviewed by a native speaker: all Armenian and Russian text (interface, 257 objects, unlock screen, store listing, privacy policy), and the Armenian letter drawings.
- Judgement calls in the content worth a human look: "Person" (genus 3 under a stated model of which passages count), "Bowling ball, holes drilled to meet inside", "Balloon, tied shut".
