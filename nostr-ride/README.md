# NostrRide 🚗⚡

A mobile-first, decentralized ridesharing app built on **Nostr**. No central
server, no database — everything is a Nostr event. Lightning payments via
**Nostr Wallet Connect**.

This guide is written for someone with **no coding experience**. Follow it
top to bottom.

---

## 1. Run it on your computer

You need **Node.js** installed first. If you don't have it, download the
"LTS" version from https://nodejs.org and install it (click through).

Open a **Terminal** (Mac: "Terminal" · Windows: "PowerShell"), then run these
one at a time (press Enter after each):

```bash
cd path/to/nostr-ride      # go into the project folder
npm install                # download building blocks (one time, ~1 min)
npm run dev                # start the app
```

Open the `http://localhost:5173/` address it prints. To stop it: `Ctrl + C`.

> **Needs internet** for styling (Tailwind loads from a CDN) and fonts.
> No API keys or accounts required. Demo data is preloaded.

---

## 2. Sign in

On the first screen you can either:
- **Create account** — generate a fresh Nostr identity, or
- **Login with key** — paste an existing `nsec1...` secret key to log in as that
  identity.

Either way these are **real Nostr keys**. Your `npub` (public) and `nsec`
(secret, hidden by default) are visible later under the **Profile** tab.

> **This is now a real multi-user app.** Ride requests, offers, acceptances,
> ratings, routes, and live location all travel over public Nostr relays (listed
> in `src/config/settings.js`), so they sync **across devices and people**. Open
> the app on two devices to see one create a request and the other respond. (The
> small set of preloaded demo requests stays local to each device and isn't sent
> to relays.) Reloading the page logs you out and clears the local cache.

---

## 3. The five tabs

| Tab | What it does |
|---|---|
| **Ride** | Create a ride request by **typing real pickup/dropoff addresses** (live search), with a map showing the **driving route**. |
| **Drive** | Toggle online/offline at the top, browse open requests, and make offers (the offer screen shows the route on a map). |
| **Activity** | Your requests (with **Cancel**) and the offers you've made. |
| **Routes** | Define recurring driver routes (for match notifications). |
| **Profile** | Identity, ratings, **Lightning wallet**, relays, and your keys. |

**Full ride flow:** Ride → publish → (as a driver from another browser/profile)
Drive → Offer → back as the rider → Activity → View offers → Accept → pay with
Lightning → Ride In Progress → Complete → rate.

**Wallet:** Profile → paste a **real** Nostr Wallet Connect string
(`nostr+walletconnect://...`) from a wallet that supports NWC (e.g. Alby Hub,
Coinos). The app reads your **real balance and transactions** from that wallet
and can send (pay an invoice) or receive (generate an invoice shown as text +
QR). If the wallet can't be reached, you'll see an error — the app never shows
made-up numbers. The online/offline toggle on Drive is a presence switch for the
upcoming nearby-drivers map; turning it off does not stop you from offering rides.

---

## 3.5 Live location (nearby drivers)

The **Drive** tab has a live map of nearby drivers. This is real and works
**across devices** over public Nostr relays:

1. Open the app and go to **Drive**.
2. Flip the toggle to **online**. Your browser asks for location permission —
   allow it.
3. Your car appears on the map (cyan). Your **approximate** location (rounded to
   ~100 m for privacy) is broadcast to relays every 15 seconds.
4. Anyone else who is online — **open the app in a second browser/phone and go
   online** — appears on the same map in real time. Stale drivers drop off after
   ~45 seconds.

How it works: location is sent as **ephemeral** Nostr events (relays forward them
to live viewers but never store them, so no location history is kept).

**During an active ride (end-to-end):**
1. A rider accepts a driver's offer.
2. The driver opens **My Activity** and sees a **Driving Now** card → taps
   **Share live location**.
3. The driver's **exact** location is now broadcast to that rider only,
   end-to-end encrypted (NIP-44), every few seconds.
4. The rider's **Ride In Progress** screen shows the driver's car moving live on
   the map.

The driver can stop sharing anytime, and only the matched rider can decrypt it.

**Requirements & notes:**
- The map uses **Leaflet** with OpenStreetMap tiles — it renders with normal page
  elements and needs **no WebGL**, so it works in essentially any browser.
- Location needs `https://` or `http://localhost`, so `npm run dev` works fine.
- These use the public relays in `src/config/settings.js`. Edit that list to use
  your own relays.
- Going online shares your approximate location publicly while online. Turning the
  toggle off stops all broadcasting immediately.
- Browsers stop GPS updates when the tab is backgrounded or the screen is off —
  that's a web limitation. Continuous background tracking would require a native
  app.

---

## 4. Where to change things

| I want to change... | Open this file |
|---|---|
| Match radius, relay list, demo data on/off, contact options | `src/config/settings.js` |
| Colors and gradients | `src/theme.js` |
| Map locations / the city | `src/lib/locations.js` |
| What a button looks like (everywhere) | `src/ui/Button.jsx` |
| The page header / back button | `src/ui/Screen.jsx` |
| The bottom tab bar | `src/ui/BottomNav.jsx` |
| The map | `src/ui/MapView.jsx` |
| A specific screen | the matching file in `src/features/...` |
| Nostr event types | `src/nostr/eventKinds.js` |

Each file is small (under ~300 lines) and starts with a comment explaining it.

---

## 5. Editing with Claude Code (recommended)

This repo includes a **`CLAUDE.md`** file — a dense map of the project that
lets Claude Code understand everything without reading every file (saving
tokens and giving better edits).

To put it in a Git repository:

```bash
cd path/to/nostr-ride
git init
git add .
git commit -m "Initial commit"
```

Then open the folder with Claude Code and ask for changes. It will read
`CLAUDE.md` automatically.

---

## 6. Going from "demo" to "real"

Each upgrade is isolated to one file (each marked with a `── TO ... ──`
comment inside it):

1. **Real relays (multi-user)** — `src/nostr/relay.js`
2. **Signed events** — `src/nostr/events.js` (`finalizeEvent`)

Keys (`src/nostr/keys.js`), the Lightning wallet (`src/nostr/wallet.js`, NIP-47),
and the maps (MapLibre + OpenStreetMap tiles + OSRM routing + Nominatim address
search) are already real.

> **About the map services:** the app uses free public endpoints — OpenStreetMap
> tiles, Nominatim (address search), and OSRM (driving routes). These are great
> for development but rate-limited and not meant for heavy production traffic. For
> a real launch, switch to paid or self-hosted equivalents (Mapbox, Maptiler,
> Google, or your own OSRM/Nominatim). The files to edit are `src/lib/geocode.js`,
> `src/lib/routing.js`, and the tile URL in `src/ui/MapView.jsx`.
