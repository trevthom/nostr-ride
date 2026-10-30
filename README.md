# NostrRide 🚗⚡

A decentralized, permissionless ridesharing system built on **Nostr**. No central server, no
database: every ride is a set of signed Nostr events. The rider pays the driver
**while the ride runs**, in small **ecash** payments (Cashu) from the rider's wallet. Keep
100% of your fares and never be unilaterally banned from using the app.

It is **one app with two faces**, chosen with a **Ride | Drive** switch. People using the two faces find each other through Nostr relays:

The same account, the same ecash wallet and the same settings serve both faces. The switch is at the top of Home, Activity / Earnings and Account. It is closed while a ride is under way.

Full documentation is in [`docs/index.md`](docs/index.md). This guide is written for someone with **no coding experience**. Follow it
top to bottom.

---

## 1. Run it on your computer

You need **Node.js** installed first. If you don't have it, download the
"LTS" version from https://nodejs.org and install it (click through). It must be
**22.23.4 or newer** (24.22.1 on the 24 line): the releases before those have the
October 2026 security fixes missing. `npm install` says so if yours is older.

Open a **Terminal** (Mac: "Terminal" · Windows: "PowerShell"), then run these
one at a time (press Enter after each):

```bash
cd path/to/nostr-ride      # go into the project folder
npm install                # download building blocks (one time, ~1 min)
npm run dev                # start the app
```

Then open **http://localhost:5173/**. To play both sides of a ride, open it in **two browser windows** (make one a private window), sign in with a different account in each,
and set one of them to **Drive** with the switch.

To stop: `Ctrl + C`.

> **Needs internet** for fonts, the map, and the relays.
> No API keys or accounts required. While you run `npm run dev`, the Drive face also
> shows a couple of fake demo requests (never in a production build).

---

## 2. Sign in

On the first screen either:
- **Create account** — makes a fresh Nostr identity, then asks you to save your secret key, or
- **I have a key** — paste an existing `nsec1...` key.

These are **real Nostr keys**. With **Remember me** (on by default) your key is
saved on this device, encrypted with a password you choose, so a reload only asks for
that password. Use a different account in each window to play both sides.

---

## 3. A ride, step by step

**Drive face** (once):
1. **Account** tab → add a **photo**, your **vehicle** (year, make, model, plate, and photos of the car: up to 3, one is enough) and, in *Account → Wallets*, a
   **Cash out location** (optional: a Lightning address, like `you@wallet.com`; you can cash out there by hand or set *Automatically cash out at*). Check the **ecash mint** you are paid at (*Account → Wallets*).
2. **Drive** tab → tap the green **GO** button (allow location when asked).

**Ride face:**
0. **Account** → pick your **currency** and add money to your **ecash wallet** (**Add funds**: pay a Lightning invoice, in one tap with a connected wallet).
1. **Where to?** → set the pickup (type an address or a business name, or pin it on the map) and the destination → see the estimated fare (each driver charges their own rates) → **Request ride**.
   Optional: show female or male drivers first. (Pick **Schedule** to reserve a ride for later: it waits under *Activity → Upcoming*.)
2. Wait for **"Finding your driver…"**. Nearby online drivers are shown as cars on the map.

**Drive face:**
3. A **request card** pops up with the fare, pickup distance and, when someone you vouch for knows and trusts the rider, a vouch badge. Tap **Accept**. Set your own base, per-mile and per-minute rates under *Account → Your rates*; riders see them, and they are frozen once a rider chooses you.

**Ride face:**
4. Pick a driver (fastest first) → **Confirm driver**. There is **no deposit**; you only need a little ecash at the driver's mint to start.
5. Watch the car come to you. The driver's exact position is end-to-end encrypted and only you can see it. Nothing is charged yet.

**Drive face:**
6. Follow the route to the pickup → **I've arrived** (works within 150 m of the pickup).

**Both faces:**
7. The driver's phone shows a 4-digit code. The rider types it on the rider's phone. Then the driver taps **Start trip**.
8. **The rider pays as the ride runs**: the base rate at the start, then every mile and every minute. Both screens show the fare so far, what is paid, and an *estimated total* (dashed, "≈"). The rider's screen also shows the **ecash balance** live (red at $5.00 or less) and the trip clock counts seconds. **Add stop / update fare** shows the estimated change in the fare before the rider asks; the driver sees it too.
9. Either person taps **Finish ride** (and confirms). The rider pays what the ride earned. The driver may waive part of the fare. The trip shows up under *Earnings* (driver) and *Activity* (rider).

**Money:** payments are tiny ecash payments from the rider's wallet to the driver, made while the ride
runs. If the rider misses **two payments**, the driver may finish the ride; the rider can refill the wallet
and pay what is missed. Adding a stop keeps the meter running at the driver's rates. All charges are shown in your local currency and paid in sats. A **mint** holds the money behind ecash,
so use one you trust. Full rules: `docs/index.md`, section *Pay as you ride*.

**Wallets:** *Account → Wallets* holds the currency, the ecash you ride with and your cash out location (the same on every phone you sign in on). A new phone has **no wallet** yet: tap **Create New Wallet** (the app warns you that the 12 words are the only way to get your money back, then shows them) or **Restore my wallet** (type the 12 words from another phone). Then *Add funds* by Lightning (any wallet pays the invoice) or on-chain on a mint that supports it, and *Send*. The app shows only what the wallet and the mint confirm, never made-up numbers.

**Lost phone?** Your ecash is saved on the device (one wallet for both faces). *Account → Recovery phrase* shows 12 words to write on paper (and asks you to type
three back). With them, a new phone finds your ecash again at the mint (*Account → Wallets → Restore my wallet*); the money then sits under the same words, so there is nothing new to write down. Keep the paper secret: whoever has the words can take the ecash.
To take the wallet off a phone you are about to lose or sell, use *Account → Wallets → Disconnect ecash from this device* (the wallet and its words are erased there, nothing is swapped; the money comes back with your 12 words).
Every part of the Account screen opens and closes when you tap its title. *Account → Appearance* has two switches that act at once: *Dark Mode (application)* for the screens and *Dark Mode (map)* for the map only. Your settings are saved to your relays by themselves, encrypted with your secret key. The password box on the sign-in page has an eye button to show what you typed.

---

## 3b. Safety, blocking and disputes

- **Safety button** (rider, during a trip): call emergency services, **share your trip** with a link a friend opens
  to follow your car live, **SOS**, or report a problem. Before you get in, the app asks you to check the plate,
  car and driver. Add trusted contacts in *Account*.
- **Block** a driver or rider from their profile or after a trip. Blocked people no longer show up for you.
- **Vouch** for people you know and trust (*Account → Your vouches*: paste their npub). There are no star ratings or reviews. When someone you vouch for also vouches for a driver or rider, their card says "N of your vouches know and trust this person". Your list is public.
- **Disputes:** every payment and confirmation is a signed record. The Drive face counts a payment only when its own mint redeemed it, and can copy a **trip record** for whoever settles a dispute.
- **Offline:** the app installs to your home screen, open offline, and send queued updates when you are back online.
- **Background GPS, and paying while the phone is in a pocket,** need the native shells in `native/` (its README, and `native/ios/README.md` to build on a Mac); a browser stops location and timers when the screen sleeps.

## 4. Privacy, in short

- Public relays only see an **approximate area** (about 1 km) for pickup and dropoff.
  The exact addresses are encrypted: first to you, then to the driver you choose.
- Your **license plate** is encrypted and sent only to the rider you drive.
- A driver who is online shares an **approximate** location (about 100 m) publicly. During a ride the
  exact location goes only to the matched rider, encrypted.
- A tip is optional and can be sent any time after a completed ride (Activity → the trip → Leave a tip).
- Ride requests, price offers and replies are public on the relays you use.
- Your **vouch list** (the npubs you know and trust) is public too.
- Looking up your address from GPS sends your position (rounded to about 10 m) to the free Photon
  geocoder. Swap that service for your own before a real launch.

---

## 5. Where to change things

| I want to change... | Open this file |
|---|---|
| Suggested-price formula, request timers, demo data | `src/config/settings.js` |
| The ecash mint a new driver starts with | `VITE_DEFAULT_MINT` in `.env` (see `env.example`) |
| Currencies, tick and finish rules | `src/lib/currency.js`, `src/lib/ticks.js`, `src/lib/finish.js` |
| Default relay list | `src/config/relays.js` |
| Colors | `src/theme.js` (and Tailwind classes in the screens; Tailwind is built into the app's CSS, `tailwind.config.js`) |
| What a button looks like (everywhere) | `src/ui/Button.jsx` |
| The bottom sheet, tab bar, page layout | `src/ui/Layout.jsx` |
| The map (tiles, pins, cars) | `src/ui/MapView.jsx` |
| Your own map / search / route servers | `.env` (copy `env.example`) |
| A Ride screen | `src/rider/screens/…` |
| A Drive screen | `src/driver/screens/…` |
| The app shell, the tabs, the Ride / Drive switch | `src/app/App.jsx`, `src/ui/ModeSwitch.jsx` |
| Nostr event types | `src/nostr/eventKinds.js` |
| The map's starting city | `src/lib/locations.js` (first entry) |

Each file is small (under ~300 lines) and starts with a comment explaining it.

---

## 6. Build for the web

```bash
npm run build      # makes dist/nostrride
npm test           # runs the automated checks
```

Put the folder on any static host (e.g. `ride.example.com`). Location needs `https://`. Browsers stop GPS when the tab is in the
background, so the Drive face keeps the screen awake while online (where the browser allows it). The Ride face does the same during a ride:
a sleeping page stops paying the ride's ecash ticks. A driver can go
online with a good GPS fix (about 200 m or better) or an approximate one (up to 25 km), so a phone's "approximate location" works, but a laptop's rough IP position (or a stale one) never shows up as a car.

**One repository.** The old generated copies `trevthom/nostr-ride-rider` and `trevthom/nostr-ride-driver` are retired: this
repository builds the one app with both faces.

> **About the map services:** the app uses free public endpoints — OpenStreetMap map tiles, Photon (address search) and OSRM (driving routes). They are fine for development but
> rate-limited and not meant for heavy traffic. Before a real launch switch to paid or self-hosted
> ones (Mapbox, MapTiler, your own OSRM/Photon). The files: `src/lib/geocode.js`,
> `src/lib/routing.js`. Or set `VITE_TILE_URL`, `VITE_PHOTON_URL` and `VITE_OSRM_URL` in `.env` (see `env.example`).

---

## 7. Editing with Claude Code (recommended)

This repo includes a **`CLAUDE.md`** file — a dense map of the project that lets Claude Code
understand everything without reading every file. Open the folder with Claude Code and ask for
changes. It reads `CLAUDE.md` automatically.
