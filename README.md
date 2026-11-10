# Mugnut

A phone game about the topology of everyday objects, because to a topologist a coffee mug and a donut are the same thing. You see an object and say what it is: a sphere, a torus, a double torus, or beyond.

**Play it:** https://edhar98.github.io/Mugnut/

- 257 hand-drawn objects in four levels and five themed packs (Kitchen, Clothing, Tools, Letters & digits in Latin and Armenian, Controversies)
- After each answer, rings on the drawing show where the holes are
- A new object every day, the same for everyone, with a streak and an archive of past days
- Journey mode: climb from Easy to Expert on three lives
- Photograph anything and challenge a friend to guess its topology, with no server involved
- English, Armenian and Russian
- Works offline once loaded, and can be added to the home screen

The web version is free and complete: no account, no ads. iPhone and Android apps that package the same game are in this repository but **have not been built or released yet** (see [Native apps](#native-apps)).

## How the game decides

- Imagine the object is made of stretchy clay: bend, stretch and squash, never tear or glue.
- The answer is the genus of its surface: the number of holes that go all the way through.
- Dents do not count. A mug's bowl is a dent; only its handle is a hole.
- Something with *n* openings into one hollow space (a T-shirt has four, a pipe has two) has genus *n* − 1.
- "5 or more" covers everything from genus 5 up.

## Files

| File | What it is |
|---|---|
| `index.html` | The game: markup, styles, logic, and the English text |
| `objects.js` | Drawing helpers and the 100 core objects |
| `packs/*.js` | The themed packs (157 objects) |
| `lang/hy.js`, `lang/ru.js` | Armenian and Russian text, loaded when chosen |
| `native.js` | Everything the phone apps add (share sheet, camera, the unlock). Does nothing on the web |
| `sw.js` | Service worker: offline play |
| `manifest.webmanifest`, `icons/`, `og.png` | Install-to-home-screen data, icons, the link-preview picture |
| `privacy.html` | Privacy policy (also the one the app stores link to) |
| `ios/`, `android/`, `capacitor.config.json` | The phone app projects (Capacitor) |
| `store/` | App store icon, feature graphic and listing text |
| `tests/` | Playwright tests |
| `tools/` | Scripts for the build stamp, rendering art, store assets and the app build |
| `PROGRESS.md`, `HUMAN_TODO.md` | Where the project stands, and what only a person can do next |

The game itself is plain HTML, CSS and JavaScript with no framework, no build step and no runtime dependencies. GitHub Pages serves the repository root as it is, and `index.html` also runs when opened straight from disk.

## Install on a phone (web version)

- **iPhone (Safari):** open the link, tap **Share → Add to Home Screen**.
- **Android (Chrome):** open the link, tap **⋮ → Install app**.

## How friend challenges work (no server)

1. **You:** Challenge a friend → New photo challenge. Take a photo, name the object, pick its topology, add an explanation and your name, then tap **Share…**. The message contains a link, and the full photo is attached when the receiving app supports it.
2. **Your friend** taps the link. The game opens with the challenge; a small preview of the photo travels inside the link itself. They guess and see your answer and explanation.
3. **They tap "Send my answer back"** and share the reply link with you.
4. **You open the reply link.** Their guess appears under your challenge with ✓ or ✗.

Things worth knowing:

- The answer is scrambled inside the link so it is not visible at a glance; a determined friend could still decode it.
- The text plus link stay under 1,000 characters, because WhatsApp and Telegram cap a photo's caption at 1,024. If the photo cannot be attached, the share screen offers a longer link with a sharper photo inside.
- Challenges made in Safari carry no preview in the link (Safari cannot make one small enough); the friend sees a placeholder and the attached photo.
- Everything is stored on your own device: records in the browser's storage, sharp photos in IndexedDB. Clearing site data or switching phones starts fresh.
- A link opened in a different browser from the installed app can be pasted under **Got a link on another device?** on the challenges screen.
- Everything that arrives in a link is treated as untrusted and shown as plain text.

## Privacy

Mugnut has no accounts, no ads and no cookies. Your names, photos, answers and challenge links stay on your device. The full policy is in [`privacy.html`](https://edhar98.github.io/Mugnut/privacy.html).

To see whether anyone plays, the live website (and only the live website) sends counts to [GoatCounter](https://www.goatcounter.com), an open-source, cookieless counter. Exactly this is sent:

- one page view each time the page loads, and a fixed event name when a round starts or finishes, the daily object or a past object is played, the archive is opened, a share button is tapped, or a challenge is created, opened or answered;
- with each of those: your screen width, and for the page view the host name of the site that linked you there (for example `news.ycombinator.com`, never the full address);
- like any web request, it reaches GoatCounter from your IP address with your browser's user-agent string.

Never sent: the page address, anything after `#` in a link (which is where challenges travel), names, notes, photos, answers, or any identifier.

Nothing is sent if your browser asks not to be tracked (Do Not Track or Global Privacy Control), or from any copy that is not the live site (a file on disk, a local server, a fork). The phone apps send nothing at all. Setting `ANALYTICS = ""` in `index.html` switches counting off completely.

## Development

The game needs no build: edit a file and reload. `npm install` is only for the tests and the app tooling.

```
npm install
```

```
npx playwright install chromium webkit
```

```
npm test
```

The tests drive the real page at phone size in Chromium (Pixel 7) and WebKit (iPhone 14): about 300 of them, covering every game mode, daily rules across midnight and clock changes, the friend-challenge round trip between two devices, hostile links, offline play, all three languages at 360 px, an accessibility audit of every screen, and the app features against a simulated app shell.

```
MUGNUT_URL=https://edhar98.github.io/Mugnut/ npm test
```

runs them against a deployed copy.

After cloning, run this once so the offline cache version is updated on every commit:

```
git config core.hooksPath .githooks
```

The cache is named after a hash of the shipped files (the "build stamp" in `sw.js`). The hook rewrites it, `npm run stamp` does the same by hand, and a test and a GitHub Action fail if it is stale.

### Adding objects

- An object is `{pack, lv, name, sub?, g, svg, ex, holes?, open?}`; the format is described at the top of `objects.js`.
- Add new objects to a pack file in `packs/`. **Never reorder, remove or edit the first 100 entries of `objects.js`:** they are the daily rotation, and a test holds a fingerprint of them.
- Draw with the helpers in `objects.js`, in the existing style: flat fills, dark outlines, no text, and background colour showing only through real through-holes.
- Every object needs hole marks (`holes` for through-holes, `open` for openings into one shared space) that add up to its answer; a test checks this for all of them.
- Add its Armenian and Russian text to `lang/hy.js` and `lang/ru.js`; a test requires every object to be translated.
- Look at what you drew:

```
node tools/render-object.js out/ --marks "Coffee mug"
```

```
node tools/contact-sheet.js out/kitchen.png --pack=kitchen
```

### Other tools

| Script | What it does |
|---|---|
| `tools/stamp.js` | Writes or checks the build stamp in `sw.js` |
| `tools/make-og.js` | Renders `og.png`, the link-preview picture |
| `tools/build-web.js` | Copies the web files into `dist/` for the phone apps |
| `tools/make-app-icons.js` | App icons and launch images for both app projects and the stores |
| `tools/make-store-shots.js` | Store screenshots in three languages at store sizes |

## Native apps

`ios/` and `android/` are Capacitor projects that package the same web files; the web version does not depend on them. **They have not been compiled or run yet**: the machine they were written on has no Xcode or Android SDK, so everything in them is unproven until built.

What they add over the web version: the system share sheet with the photo attached, the camera, a buzz on right and wrong answers, an optional daily reminder, and a one-time purchase. In the apps, Easy, Medium, the daily object and friend challenges are free; one purchase (never a subscription) opens Hard, Expert, every pack and the full Journey. The web version stays fully open.

```
npm run cap:sync:mock
```

copies the game into `dist/` with a simulated store, so the unlock can be tried without any store account, and syncs both projects. `npm run cap:sync` does the same for store builds.

```
npm run ios
```

```
npm run android
```

open them in Xcode and Android Studio. [`HUMAN_TODO.md`](HUMAN_TODO.md) lists what is needed to build and publish: the tools to install, developer accounts, the purchase to create in each store, signing, and what to test on a real device.

## Status

[`PROGRESS.md`](PROGRESS.md) records what has been built, how it was checked, and the known loose ends.
