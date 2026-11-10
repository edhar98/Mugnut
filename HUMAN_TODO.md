# Things only you can do

Updated: 2026-11-11. The web version is live and needs nothing from you. Everything below is about the phone apps, plus two reviews of wording.

Open items first. Nothing here blocks current work unless it says so.

## Open

Phase 3 (native apps) is built as far as this Mac allows. It has no Xcode, no Java and no Android SDK, so **neither app has been compiled or run yet**. The steps below are in the order to do them.

### 1. Decide the app id (before anything is created in a store)
The projects use `app.mugnut.game`. It can never be changed once an app is published under it. If you want a different one, tell me and I will regenerate both projects (it is in `capacitor.config.json`, `android/app/build.gradle` and the Xcode project).

### 2. Install the build tools (about 20 GB, free)
1. **Xcode** from the Mac App Store. Open it once and accept the licence, then run:
   ```
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```
2. **Android Studio** from https://developer.android.com/studio . Open it once and let the setup wizard install the Android SDK and an emulator image (it also brings its own Java).
3. Tell me when both are installed: I can then build both apps, run them on the simulator and emulator, and fix whatever real devices reveal. Until that has happened, treat everything native as unproven.

To try it yourself:
```
npm run cap:sync:mock
```
```
npm run ios
```
```
npm run android
```
`cap:sync:mock` builds with a simulated store, so the unlock can be tried without any store account. Use `npm run cap:sync` for real store builds.

### 3. Developer accounts (yours to create and pay for)
- **Apple Developer Program**: https://developer.apple.com/programs/enroll/ (US$99 per year).
- **Google Play Console**: https://play.google.com/console/signup (US$25 once). New personal accounts must run a closed test with 12 testers for 14 days before they can publish.

### 4. Create the apps and the purchase in each store
Values to enter are in `store/listing.md` (name, subtitle, descriptions in English, Armenian and Russian, keywords, category, age rating, privacy answers).
- **App Store Connect** → My Apps → + → New App: platform iOS, name `Mugnut`, primary language English, bundle id `app.mugnut.game`, SKU `mugnut`.
  - In-App Purchases → + → **Non-Consumable**: reference name `Unlock everything`, product id **`unlock_all`**, price US$2.99, display name and description from `store/listing.md`, plus a screenshot of the unlock screen for review.
  - Agreements, Tax and Banking: sign the Paid Apps agreement (purchases do not work, even in testing, until it is active).
  - App Privacy: "Data Not Collected". Privacy policy URL: `https://edhar98.github.io/Mugnut/privacy.html`.
- **Google Play Console** → Create app: name `Mugnut`, default language English, Game, Free.
  - Monetise → Products → In-app products → Create: product id **`unlock_all`**, name `Unlock everything`, price US$2.99, activate it. (This needs a payments profile, and an app bundle uploaded to a test track first.)
  - Data safety: no data collected, no data shared. Privacy policy URL as above.

### 5. Signing (never commit these; `.gitignore` already excludes them)
- **iOS**: in Xcode open `ios/App/App.xcodeproj` → target App → Signing & Capabilities → tick "Automatically manage signing" and choose your team.
- **Android**: Android Studio → Build → Generate Signed App Bundle → create a new keystore. Keep the keystore file and its passwords somewhere safe outside this folder; losing them means you can never update the app. Enrol in Play App Signing when the console offers it.

### 6. Links that open the app (optional, decide which route)
Challenge links look like `https://edhar98.github.io/Mugnut/#c=…`. For a tap on such a link to open the installed app, the *domain* must vouch for the app with files under `/.well-known/` at the root of the host. A project site lives under `/Mugnut/`, so it cannot provide them. Options:
- **A. A custom domain** (for example `mugnut.app`, about US$15 a year) pointed at GitHub Pages. Then `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` can sit in this repository, and links become `https://mugnut.app/#c=…`. Cleanest; needs the links in the game changed to the new domain (I can do that).
- **B. The user-level Pages repository** `edhar98/edhar98.github.io`, which serves the host's root. The two files go there. No cost, but it is another repository under that account's control.
- **C. Do nothing.** Links open the web version, where the challenge works. On Android the player can still choose "Open by default" for Mugnut in system settings.
The apps already listen for such links; iOS additionally needs the Associated Domains capability switched on in Xcode (`applinks:<host>`), which I will add once you pick A or B and have a developer account.

### 7. Test, then submit (yours to press)
- Test purchases with an App Store sandbox tester and a Google Play licence tester before submitting. The checks that matter, none of which could be run here:
  - buy, then force-quit and reopen: still unlocked;
  - **Android: buy as a licence tester, wait 10 minutes, reopen: still unlocked** (Google refunds a purchase the app failed to acknowledge; for testers that happens within minutes);
  - back out of the payment sheet: no error message;
  - delete and reinstall, then "Restore purchases": unlocked;
  - refund the test purchase: locked again at the next start;
  - a photo challenge: the share sheet shows the photo and the link; the camera opens from "Take photo";
  - the daily reminder arrives the next morning.
- Submit for review in each console. Reviewers will ask how to test the purchase: say "the unlock is on the menu under any locked level".

### Also waiting on you
- Say when you want Phase 4 (launch posts for you to publish, and a metrics checklist); it is not started.
- A native-speaker pass over the Armenian and Russian text, including the new unlock, reminder and store-listing wording (`lang/hy.js`, `lang/ru.js`, `store/listing.md`, `privacy.html`).
- Confirm the Armenian letter drawings in the Letters pack.

## Done
- 2026-11-10: collaborator invitation to `edhar98/Mugnut` accepted; pushes work.
- 2026-11-11: GoatCounter account registered. Site code `mugnut` (count endpoint `https://mugnut.goatcounter.com/count`).
- 2026-11-11: GoatCounter email verified; the dashboard shows visits and events arriving from the live site.
- 2026-11-11: Gate 2 decision: the Beyond genus pack is skipped.
