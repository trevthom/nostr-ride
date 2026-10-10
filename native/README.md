# Native shell for the driver app (background GPS)

A web page cannot read the location once the screen is off or the app is in the
background. This folder wraps the **driver app** in a native app (Capacitor) that
can, through an Android foreground service or an iOS background mode. The web build is
unchanged: `src/lib/nativeGeo.js` looks for the plugin at run time and uses it only
inside this shell. In a browser nothing changes.

> **Status: written but NOT tested on a device.** The adapter is unit-tested with a fake
> plugin. Real background behavior (battery limits, OS prompts, whether the WebView keeps
> running with the screen off) must be tried on a real phone. You also need Android Studio
> (Android) or Xcode on a Mac (iOS) to build.

## Steps
```bash
cd native
npm install                 # Capacitor and the background-geolocation plugin
npm run sync                # builds ../dist/driver and copies it in
npx cap add android         # once  (and/or: npx cap add ios)
npm run sync
npm run android             # opens Android Studio; run on a phone
```

## Permissions to add after `cap add`
**Android** (`android/app/src/main/AndroidManifest.xml`), inside `<manifest>`:
```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```
**iOS** (`ios/App/App/Info.plist`):
```xml
<key>NSLocationWhenInUseUsageDescription</key><string>Shows your car to your rider.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key><string>Keeps sharing your location with your rider while the app is in the background.</string>
<key>UIBackgroundModes</key><array><string>location</string></array>
```
Also read the plugin's own README (`@capacitor-community/background-geolocation`) for
current setup notes; platform rules change often. Google Play and the App Store both ask
for a reason for background location. Say it is for sharing the driver's position with
the rider during a trip.

## What the app does differently inside the shell
- Location comes from the background watcher, with a persistent "Driving with NostrRide" notification.
- A location is sent to the rider on each fix (at most every 5 s), not on a timer that the OS may pause.
- The screen wake lock and the service worker are skipped.
