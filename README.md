# Mugnut

A phone game about the topology of everyday objects — because to a topologist, a mug is a donut. Is it a sphere, a torus, a double torus…? It has 100 hand-drawn objects in 4 levels, a Journey mode, and photo challenges you send to friends.

It runs entirely in the browser: no server, no account, no tracking, and it works offline once loaded.

## Files

| File | What it is |
|---|---|
| `index.html` | The whole game (drawings, logic, styles) |
| `manifest.webmanifest` | Makes it installable ("Add to Home Screen") |
| `sw.js` | Service worker that caches the game for offline play |
| `icons/` | App icons |

## Put it online for free (GitHub Pages, about 5 minutes)

1. Create a free account at github.com and click **New repository**. Name it e.g. `Mugnut`, make it **Public**, and create it.
2. On the repo page click **Add file → Upload files** and drag in everything from this folder (including the `icons` folder). Then click **Commit changes**.
3. Go to **Settings → Pages**. Under *Build and deployment* choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
4. After a minute, your game is live at `https://<your-username>.github.io/Mugnut/`.

Netlify works too: go to app.netlify.com/drop and drag this folder onto the page.

> The game has to be served over **https** for installing, offline mode and the share button to work. Opening `index.html` straight from your files still lets you play the quiz.

## Install on a phone

- **iPhone (Safari):** open the link, tap **Share → Add to Home Screen**.
- **Android (Chrome):** open the link, tap **⋮ → Install app** (or *Add to Home screen*).

## How friend challenges work (no server)

1. **You:** Challenge a friend → New photo challenge. Take a photo, name the object, pick its topology, add an explanation and your name, then tap **Share…**. Your phone's share sheet opens (WhatsApp, Telegram, Messages…). The message contains a link, and the full photo is attached when the app supports it.
2. **Your friend** taps the link. The game opens with the challenge (a small copy of your photo travels inside the link). They guess and see your answer and explanation.
3. **They tap "Send my answer back"** and share the reply link with you.
4. **You open the reply link.** Their guess appears under your challenge with ✓ or ✗.

The answer is scrambled inside the link, so it isn't visible at a glance. A determined friend could still decode it, though.

Your challenges, answers and daily streak are saved on your own phone (browser storage). Clearing the browser data or switching phones starts fresh. If a link was opened in a different browser than the installed app, paste it under **Got a link on another device?** on the challenges screen.

Challenge links carry a compressed copy of the photo (WebP where the phone supports it), about 12,000 characters. That's fine for WhatsApp, iMessage, Signal and e-mail. Telegram cuts messages at 4,096 characters, so the share screen also offers a **short link** with a smaller photo. If the full photo was attached in the chat, your friend can tap *Use it for full quality*. Your own challenges are always shown in full quality on your phone.

## Updating

Change the files and upload them again. If players still see the old version, bump `CACHE = "mugnut-v1"` in `sw.js` to `v2`. Phones then fetch the new version on their next visit.
