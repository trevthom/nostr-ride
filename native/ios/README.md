# iOS shell — build and sign on a Mac

The Xcode project for the one app with two faces. It is a **Capacitor shell**: the same
`dist/nostrride` build the web app uses, wrapped so iOS will let it keep the location and the
payment loop running with the screen off. Nothing in `src/` is iOS-specific.

This folder was generated and configured on Linux, which means it has **never been compiled**.
Everything below is the first thing to run on your Mac; treat the first build as a setup step,
not as a release.

## What is already set up

| | |
|---|---|
| Bundle id | `app.nostrride` (`PRODUCT_BUNDLE_IDENTIFIER` in the Xcode project) |
| Name | NostrRide (`CFBundleDisplayName`) |
| Deployment target | iOS 13.0 |
| Location | `NSLocationWhenInUse…`, `NSLocationAlwaysAndWhenInUse…`, `NSLocationAlways…` and `UIBackgroundModes: location` in `App/App/Info.plist` |
| Camera/photos | `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription` |
| Orientation | iPhone portrait only; iPad all |
| Icons | `App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` — 1024×1024, no alpha (the App Store rejects an icon with an alpha channel) |
| Splash | white with the app mark, in `Assets.xcassets/Splash.imageset` |
| Plugins | `@capacitor-community/background-geolocation` and the local `nostrride-heartbeat` (`../plugins/heartbeat`), both in `Podfile` (CocoaPods) |

The icon and splash are generated from `../resources/icon.png` / `../resources/icon-foreground.png`,
which come from the bolt mark in `apps/nostrride/public/icon.svg`. Replace those masters and
re-run whatever resizes them if the brand changes.

## 1. Prerequisites

- macOS with **Xcode 15 or newer** (App Store), and the command line tools:
  `xcode-select --install`
- **CocoaPods**: `sudo gem install cocoapods` (or `brew install cocoapods`)
- **Node 22.23.4 or newer** (`node -v`) — the app's `engines` field enforces this
- A free Apple ID is enough to run on your own phone. TestFlight and the App Store need a paid
  Apple Developer account.

## 2. Build the web app and sync it

From the repository root (the folder that has `package.json`):

```bash
npm ci
npm run build                     # writes dist/nostrride
cd native
npm install
npx cap sync ios                  # copies dist into the Xcode project and runs pod install
npx cap open ios                  # opens ios/App/App.xcworkspace
```

Open the **`.xcworkspace`**, not the `.xcodeproj`: once CocoaPods has added the plugin, the
workspace is what knows about it.

Re-run `npm run build && npx cap sync ios` after every change to the web app — the shell embeds
the build, it does not load the site over the network. That is deliberate: this app holds keys and
money, so it must not run code fetched from elsewhere.

## 3. Sign it

In Xcode: select the **App** target → **Signing & Capabilities**.

- Tick **Automatically manage signing**, choose your **Team** (your Apple ID).
- The bundle identifier `app.nostrride` is almost certainly taken; change it to something unique
  to you, e.g. `com.yourname.nostrride`. Xcode writes it into the project. **Once a build is on
  the App Store, this id is permanent** — never ship a placeholder.

To run on a phone:

1. Plug the iPhone in, select it as the destination (not a simulator: the simulator has no real GPS).
2. Xcode → Settings → Accounts: add your Apple ID if it is missing.
3. On the iPhone, enable **Developer Mode** (Settings → Privacy & Security → Developer Mode) and
   trust the developer certificate (Settings → General → VPN & Device Management).
4. Run. The first launch asks for location.

## 4. The location prompts you will see

This is the part that matters for a working app, so it is worth knowing what to expect:

- The **first** prompt is *While Using the App* — the ordinary one, asked when the app starts.
- When a **ride starts**, the app restarts its location watcher in background mode and iOS shows
  the *Change to Always Allow* sheet. **Always** is what lets the app keep running (and the rider
  keep paying ticks) with the phone in a pocket. If it is declined, the app still works in the
  foreground and pays the outstanding fare when it next wakes — nothing is lost.
- iOS periodically reminds the person that the app is using their location in the background.
  That is iOS, not a bug.

The reasons written into `Info.plist` are the ones App Review reads. Keep them true if you change
what the app does with location.

## 5. TestFlight and the App Store

```text
Product → Archive → Distribute App → App Store Connect → Upload
```

- **Background location justification** (asked in App Store Connect and by review): the Drive face
  shares the driver's position with their rider during a trip; the Ride face measures the trip on
  the rider's own phone. Same sentence on Google Play.
- **Guideline 4.2 (minimum functionality)** is the real risk for a web app in a shell. The answer
  is that this is not a website wrapper: it runs a continuous background location session under
  an Always permission, it measures and pays a ride while the phone is locked, and it works with
  no network at launch. Say that, and expect to explain it once.
- **Encryption**: App Store Connect asks on every submission. This app uses standard
  cryptography only (schnorr signatures, NIP-44/NIP-49, Cashu blind signatures) and adds no
  proprietary cipher. Answer the prompt honestly rather than pre-setting
  `ITSAppUsesNonExemptEncryption`, which stays out of `Info.plist` on purpose.
- **No push notifications**: by design there is no server, so there is nothing to send a push.
  Notifications inside the shell come from the location session and the app itself.

## 6. What you cannot check here, and must check on the phone

- That the background location session really keeps the page alive with the screen locked (this is
  what the rider's tick payments hang off — see `src/lib/useGeolocation.js`, `heartbeat`).
- That the metronome really wakes the page: start a ride, lock the phone and **leave it still**
  (a fix needs movement, a beat does not), then watch the driver's phone receive ticks every
  minute or so. `native/plugins/heartbeat` is the Swift side; if Xcode reports the pod missing, run
  `pod install` again — Capacitor renames the pod from the package name (`NostrrideHeartbeat`).
- Battery use over a real 20-minute trip, and what iOS does to a long background session.
- The exact wording and timing of the two location prompts on a current iOS version.
- That the App Store accepts the shell (4.2) and the background-location justification.

## 7. Debugging

- Xcode → **Debug → Simulate Location** to move the phone around a map without driving.
- The web console: Safari → Develop → [your iPhone] → the app's web view.
- `npx cap run ios --list` shows devices; `npx cap sync ios` is safe to run any time.
- If `pod install` fails after an Xcode update, `cd ios/App && pod repo update && pod install`.
