# Mugnut — progress

Updated: 2026-11-11

## Done

### Phase 0 — Setup
- Independent review of `daily-mode`: changes requested, fixed, then approved.
- Merged to `main` as [edhar98/Mugnut#1](https://github.com/edhar98/Mugnut/pull/1) (merge commit `fc1fce4`); the live site was checked afterwards by running the whole suite against it: 54 passed.
- `MUGNUT_URL=<url> npx playwright test` runs the suite against a deployed copy (branch `live-check-config`, not merged yet: goes in with the first Phase 1 pull request after review).
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

## In progress
- Nothing. Next is Phase 2 (content to 250+ objects, hole highlighting, Armenian and Russian, accessibility).

## Blocked on the human
- Nothing blocking. See `HUMAN_TODO.md` for the GoatCounter email verification.

## Backlog notes
- Small follow-ups from the last review, none affecting stored data: the share card right after creating a challenge shows the link preview rather than the sharp photo; "Share again" can wait several seconds if IndexedDB hangs; the "See it sharp" label can show wrongly if two challenges are opened within milliseconds; `tools/make-og.js` uses Apple system fonts, so regenerate `og.png` on a Mac.
- The GitHub Action only checks the build stamp; it does not run the Playwright suite.
- New objects must be appended to the end of `OBJECTS`; the first 100 entries are the daily rotation and must not be reordered or removed (a test pins this).
- Analytics is off inside a future native app (it only fires on the live web host); decide in Phase 3 whether the apps should count too.
- No test covers a real upgrade from an old service worker to a new one (checked by hand by the reviewer).
- Challenges created in Safari travel without an in-link preview (JPEG headers alone exceed the caption budget). The attached photo still goes through the share sheet. Native share in Phase 3 removes the limit; a smaller hand-rolled preview format would fix it on the web.
- The home text says "100 objects"; it must follow the object count when content grows in Phase 2.
