# NostrRide documentation

Last updated with: **two-app split, OpenStreetMap tiles, GPS quality checks** (see the [changelog](#changelog)).

NostrRide is a decentralized ridesharing system. It is **two web apps** — a rider app and a driver
app — that find each other through **Nostr relays**. There is no company server and no database.
Payments go straight from rider to driver over **Lightning**.

> This page is kept up to date with every change. If you change behavior, update the matching
> section and add a line to the [changelog](#changelog) in the same commit.

## Contents
1. [Quick start](#quick-start)
2. [The two apps](#the-two-apps)
3. [How a ride works](#how-a-ride-works)
4. [Architecture](#architecture)
5. [Nostr events](#nostr-events)
6. [Privacy](#privacy)
7. [Payments](#payments)
8. [Location and GPS](#location-and-gps)
9. [Configuration](#configuration)
10. [Testing](#testing)
11. [Deploying](#deploying)
12. [Self-hosting map services](#self-hosting-map-services)
13. [Known limits and roadmap](#known-limits-and-roadmap)
14. [Changelog](#changelog)

## Quick start
```bash
npm install
npm run dev        # rider http://localhost:5173 , driver http://localhost:5174
npm test           # automated checks
npm run build      # dist/rider and dist/driver
```
Open the two apps in two browser windows and sign in with a different account in each.
Needs internet for Tailwind (CDN), fonts, the map, and the relays. Location needs `https://` or `localhost`.

## The two apps
| | Rider app (`apps/rider`, `src/rider`) | Driver app (`apps/driver`, `src/driver`) |
|---|---|---|
| Tabs | Ride · Activity · Account | Drive · Earnings · Account |
| Home | "Where to?" → fare → request | GO button → request cards |
| During a trip | Live car, ETA, contact, cancel | Route, arrived / start / complete |
| After a trip | Receipt, pay the rest, rate | Summary, rate the rider |
| Needs | Nothing (a wallet is optional) | Photo, vehicle, plate, Lightning address |

Both apps share one code base for Nostr, maps, payments, profiles and UI (`src/nostr`, `src/lib`,
`src/ui`, `src/features`, `src/state`). The rider app must never import from `src/driver`, and the
reverse. The Vite *mode* picks the app (`vite --mode rider|driver`).

## How a ride works
1. The driver taps **GO** (needs a good GPS fix). The app shares an approximate location.
2. The rider enters a destination and sees a **fare**, then taps **Request**.
3. Nearby drivers get a **request card** with a countdown. A driver taps **Accept** (an offer at the quoted fare).
4. The rider **chooses a driver** and pays the **deposit** (default 20%). This starts the drive.
5. The driver drives to the pickup. The rider sees the car move live (end-to-end encrypted).
6. The driver taps **I've arrived**, **Start trip**, **Complete trip**.
7. The rider pays the **rest of the fare** and both sides rate each other.

Cancels: the rider can cancel any time; the driver can cancel an accepted ride. A reservation more
than 30 minutes ahead waits under *Activity → Upcoming*. Everything on screen is **derived from the
signed events**, so a reload or a second device shows the same screen.

## Architecture
```
user action ─▶ signed Nostr event ─▶ relays (and a local cache)
                                       │
relays ─▶ local cache ─▶ screens read it with relay.query()
```
- `src/state/AppContext.jsx` — shared state (`useApp()`): user, tab, ride requests, `publish`, notices, BTC price, wallet.
- `src/rider/state/RiderContext.jsx`, `src/driver/state/DriverContext.jsx` — role state.
- `src/lib/trips.js` — works out the current ride from events (`activeRideFor`, `activeDriveFor`, offers).
- `src/lib/rides.js` — the **trust rules** (who may cancel, complete, mark a stage, or rate).
- `src/ui/Layout.jsx` — page structure: full-screen map with a bottom sheet, tab bar.

More detail for contributors is in `CLAUDE.md` (the file map and every invariant).

## Nostr events
| Kind | Name | Sent by | Purpose |
|---|---|---|---|
| 0 | Metadata | anyone | Name, photo, Lightning address, vehicle (plate sealed) |
| 30078 | Ride request | rider | Coarse pickup/dropoff, fare, sealed exact trip |
| 30079 | Ride offer | driver | "I'll take it": price, deposit, ETA, sealed plate |
| 30080 | Ride accept | rider | Confirms a driver; exact trip sealed to the driver |
| 30081 | Ride cancel | rider or assigned driver | Ends a ride |
| 30082 | Rating | either party | Stars and review |
| 30084 | Ride complete | assigned driver | Ends a ride as completed |
| 30085 | Ride stage | assigned driver | `arrived` / `riding` |
| 30090 | Presence | driver | Online, coarse location, short expiry |
| 21100 | Ride location | driver | Exact location, encrypted to the rider, ephemeral |

Every event carries the app tag `["t","nostrride"]` because kind numbers like 30078 are shared with other apps.

## Privacy
- Public relays see only an **approximate area** (about 1 km) for pickup and dropoff. The exact trip is
  encrypted (NIP-44) first to the rider, then to the chosen driver.
- The **license plate** is sealed to the rider who receives the offer.
- A driver who is online shares a location rounded to about 100 m. The exact position goes only to the matched rider.
- Requests, fares, offers and notes are public on the relays you use.
- Looking up an address from GPS sends the position (rounded to about 10 m) to the Photon geocoder.

## Payments
Payments are **peer to peer over Lightning, with no escrow**. The rider pays the driver's Lightning
address: the **deposit** when choosing a driver, the **rest** after the trip. The deposit is not
refunded if the rider cancels after the driver is on the way. The app checks that an invoice is for
the exact amount before paying. Riders can pay with a connected NWC wallet or scan an invoice with any wallet.
Fares are quoted in dollars and converted to sats with the live BTC price (a fallback price is used,
with a warning, when the price feed is down).

## Location and GPS
- A fix is **good** (accurate to 200 m or better), **weak**, or **stale** (older than 60 seconds).
- A driver can go online, and is shown to riders, only with a good fix.
- During a drive the exact position is sent unless it is stale.
- The driver app keeps the screen awake while online or driving (browsers stop GPS when the screen sleeps).
- ETAs use the road time from the router, with a straight-line guess as a fallback.
- Browsers cannot track location in the background. See the roadmap for the native option.

## Configuration
| What | Where |
|---|---|
| Fare formula, deposit %, timers, demo data | `src/config/settings.js` |
| Relays | `src/config/relays.js` (also editable in the app) |
| Map tiles | `TILE_URL` in `src/ui/MapView.jsx` |
| Address search / routing | `src/lib/geocode.js`, `src/lib/routing.js` |
| Colors | `src/theme.js`, Tailwind classes |

## Testing
`npm test` runs `test/*.test.mjs` with Node's built-in runner: trust rules, ride stages, fares, trips,
earnings, privacy, history, Lightning invoices, geocoding, publishing, event ordering, contact links, GPS.
The apps were also exercised end to end in a headless browser (a rider and a driver playing a full ride
through a local relay). That harness is not in the repo.

## Deploying
`npm run build` makes `dist/rider` and `dist/driver`. Put each on any static host (for example
`ride.example.com` and `drive.example.com`). Use `https://` (location needs it). Each app keeps its own
saved key in the browser.

## Self-hosting map services
The app uses three free public services. They are fine for development but not for real traffic.

| Need | Today | Self-hosted option |
|---|---|---|
| Map tiles | `tile.openstreetmap.org` | See below |
| Address search | Photon (`photon.komoot.io`) | Run your own [Photon](https://github.com/komoot/photon) (needs an OpenSearch index; a country extract is a few GB) |
| Driving routes | OSRM demo server | Run [OSRM](https://github.com/Project-OSRM/osrm-backend) in Docker on a regional `.osm.pbf` (RAM scales with the region) |

**Map tiles — three ways to host them**
1. **Raster tile server** (closest to what the app uses now). Run the Docker image
   `overv/openstreetmap-tile-server` on a VPS. It imports a regional extract from Geofabrik
   (`.osm.pbf`) into PostGIS and serves `https://your.host/tile/{z}/{x}/{y}.png`. A state or country
   extract imports in about an hour on a modest VPS and needs a few GB of disk. The whole planet needs
   1 TB or more, so use a region. The look is the standard OSM style.
2. **Protomaps / PMTiles** (best fit for a no-server project). One `.pmtiles` file holds a whole region
   as vector tiles. Cut an extract with the `pmtiles extract` command and put the file on any static
   host (S3, R2, a plain web server) that supports HTTP range requests. No server process. The app
   would draw it with `protomaps-leaflet` (canvas, no WebGL) in place of the raster layer.
3. **Paid or hosted provider** (MapTiler, Stadia, Mapbox). No servers to run; you pay by usage.

Whichever you choose, keep the "© OpenStreetMap contributors" credit (the data licence requires it).
Switching is a change to the tile layer in `src/ui/MapView.jsx` only.

## Known limits and roadmap
- No escrow. Ideas, from lowest effort: reputation-scaled deposits, signed dispute evidence, Lightning
  hold invoices, then 2-of-3 escrow with an arbiter (and stablecoins later).
- No in-app chat; the Contact sheet shows the other person's Signal, Telegram or phone.
- No background GPS on the web.
- Free public map, geocoder and router services need replacing before launch.

## Changelog
- **Two apps** — rider and driver apps with an Uber/Lyft-style UI; new ride-stage event (30085); state is derived from events.
- **Maps and GPS** — OpenStreetMap tiles; GPS quality checks (good / weak / stale); screen wake lock for drivers; road-time ETAs.
