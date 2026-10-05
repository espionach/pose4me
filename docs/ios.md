# poseforme on iOS

The iPhone app is the web app (Next.js static export in `out/`) wrapped with Capacitor 8.
On iPhone, data is stored in SQLite and photos are files in the app's Documents folder
(`images/{photoshoot_id}/{pose_id}.jpg`); see `lib/db/native.ts`.

- App name: **poseforme**
- Bundle ID: **com.priyatiarraapp.poseforme**
- iPhone only, portrait only, iOS 15+
- Native plugins come in through Swift Package Manager (no CocoaPods needed)

## What you need

- A Mac with **Xcode** (from the Mac App Store) and **Node 20+**.
- An **Apple ID** signed in to Xcode (Xcode → Settings → Accounts). A free Apple ID is enough
  to run on your own iPhone; uploading to the App Store needs a paid
  [Apple Developer Program](https://developer.apple.com/programs/) membership.
- Your iPhone and a USB-C/Lightning cable.

## 1. Build the web app and copy it into iOS

From the project folder:

```bash
npm install
```

```bash
npm run build:ios
```

`build:ios` runs `next build` (static export to `out/`) and `npx cap sync ios` (copies `out/`
into the Xcode project and updates native plugins). Run it again after **any** change to the
web code — the iOS app only sees what was last synced.

`npm install` also re-applies `patches/@capacitor+camera+*.patch`, which makes Apple's photo
picker number your picks and return them in the order you tapped them.

## 2. Open the project in Xcode

```bash
npm run open:ios
```

This opens `ios/App/App.xcodeproj`. The first time, Xcode downloads the Swift packages
(SQLite, camera, filesystem, …) — watch the progress at the bottom of the left sidebar.

## 3. One-time signing setup (manual, in Xcode)

1. In the left sidebar, click the blue **App** project, then the **App** target.
2. Open the **Signing & Capabilities** tab.
3. Tick **Automatically manage signing**.
4. **Team**: choose your Apple ID / developer team.
5. Check **Bundle Identifier** is `com.priyatiarraapp.poseforme`. If Xcode says the ID is
   unavailable, it's taken by another account — pick a new one and also change `appId` in
   `capacitor.config.ts`, then run `npm run build:ios`.

## 4. Run on your iPhone

1. Plug the iPhone in and unlock it. Tap **Trust** if it asks.
2. On the iPhone, turn on **Developer Mode**: Settings → Privacy & Security → Developer Mode →
   on, then restart the phone when asked. (This option appears after the phone has been
   connected to Xcode once.)
3. In Xcode's toolbar, choose your iPhone as the run destination (next to the ▶︎ button).
4. Press **▶︎ Run** (⌘R).
5. The first time, the iPhone may block the app as an "Untrusted Developer": on the phone go to
   Settings → General → VPN & Device Management → your Apple ID → **Trust**, then run again.

To try it in the Simulator instead, pick any iPhone simulator as the destination and press ▶︎.

Apps signed with a **free** Apple ID stop opening after 7 days — just run from Xcode again.

## 5. Archive and upload to the App Store

1. In App Store Connect (<https://appstoreconnect.apple.com>) → **Apps** → **+** →
   **New App**: platform iOS, name **poseforme**, bundle ID `com.priyatiarraapp.poseforme`
   (register it first under Certificates, Identifiers & Profiles → Identifiers if it isn't
   listed), and a SKU of your choice.
2. Bump the version for each upload: in Xcode → App target → **General** → **Version**
   (e.g. 1.0.1) and **Build** (must increase every upload, e.g. 2).
3. Build the latest web code: `npm run build:ios`.
4. In Xcode's toolbar, set the destination to **Any iOS Device (arm64)**.
5. **Product → Archive**. When it finishes, the Organizer window opens.
6. Select the archive → **Distribute App** → **App Store Connect** → **Upload** → follow the
   prompts (keep automatic signing).
7. After processing (usually 5–30 minutes) the build appears in App Store Connect under
   **TestFlight**, ready for testers or to attach to a version for review.

Already set in `ios/App/App/Info.plist`:

| Key | Value |
|---|---|
| NSPhotoLibraryUsageDescription | Pick inspiration photos for your shoot plans. |
| NSPhotoLibraryAddUsageDescription | Save your shoot plan image to Photos. |
| NSCameraUsageDescription | Take a photo to use as a pose. |
| ITSAppUsesNonExemptEncryption | NO (skips the export-compliance question) |
| Orientation | Portrait only |

The photo picker has no camera option, but `NSCameraUsageDescription` must stay: the camera
plugin contains camera code, and App Store Connect rejects uploads that lack the text
(ITMS-90683) even if the camera is never shown.

## App icon and splash screen

Placeholders live in `resources/`:

- `icon-only.png` — 1024×1024, no transparency
- `splash.png`, `splash-dark.png` — 2732×2732, artwork centred on `#FBF8F3`

To use final artwork, replace those files (same names and sizes), then:

```bash
npm run assets:ios
```

## Day-to-day

| Task | Command |
|---|---|
| Work on the app in a browser | `npm run dev` (http://localhost:3000) |
| Run the end-to-end tests (web build) | `npm run test:e2e` |
| Push web changes into the iOS app | `npm run build:ios`, then ▶︎ in Xcode |

## How it works on iPhone

- **Photos**: "next · pick photos", "+ add poses" and the polaroid's camera button open Apple's
  photo picker, which numbers your picks; poses open in that order. HEIC photos arrive as JPEG;
  the app resizes to 1600px (JPEG ~0.85) before saving.
- **Photo access**: the first time, iOS asks to allow access to the photo library (the camera
  plugin asks so it can read photo details). "Select Photos" (limited) and "Allow Full Access"
  both work; if it's turned off, the app explains how to turn it back on in Settings.
- **Keyboard**: the keyboard slides over the screen without resizing it, so layouts stay as
  designed; the keyboard's return key submits on Welcome and New shoot.
- **Save to photos** (Export) saves each page as a PNG straight into Photos; the first time,
  iOS asks for permission to add photos.
- **Storage**: SQLite database `poseforme` (in `Library/CapacitorDatabase`) plus image files.
  Deleting a pose or shoot deletes its files. Data is included in the phone's iCloud/Finder
  backup; deleting the app deletes the data.
