# Mugnut — progress

Updated: 2026-11-10

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

## In progress
- Phase 1 — validation features (analytics hook, daily archive and countdown, Open Graph image, automatic cache version, photos in IndexedDB).

## Blocked on the human
- Nothing blocking. Gate 0 answered: GoatCounter, site code `mugnut`; analytics is not wired in yet (Phase 1).

## Backlog notes
- **Before adding objects (Phase 2):** the daily object is picked by position in `OBJECTS`, so adding or reordering objects changes every day's object. Give the daily rotation its own fixed list first.
- Phones that opened a malformed challenge link on the current live site keep a bad record that still breaks their Friends list; drop received entries with a non-integer answer when loading (do with the IndexedDB migration).
- Link data is not size-capped: a very large pasted link can fill browser storage, after which saves fail silently. Cap preview length and the number of received challenges (fits with the IndexedDB move in Phase 1).
- Challenges created in Safari travel without an in-link preview (JPEG headers alone exceed the caption budget). The attached photo still goes through the share sheet. Native share in Phase 3 removes the limit; a smaller hand-rolled preview format would fix it on the web.
- `og:image` currently points at the 512 px icon; a 1200×630 image is planned in Phase 1.
- The home text says "100 objects"; it must follow the object count when content grows in Phase 2.
