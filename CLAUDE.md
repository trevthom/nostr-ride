# CLAUDE.md

Guidance for AI coding agents working in this repo. Read this first; it
should let you make correct edits without reading every file.

## What this is
NostrRide — a mobile-first, decentralized ridesharing web app. **Nostr is the
only backend** (no server, no DB). Stack: **React 18 + Vite**. **Tailwind is
loaded from a CDN** in `index.html` (NOT a build dependency — do not add
`@tailwindcss/vite` or `tailwindcss` to package.json; its native binary breaks
on some machines, which is why it was removed).

## Commands
- `npm install` then `npm run dev` → dev server at http://localhost:5173
- `npm run build` → production build (use to verify changes compile)
- No test suite, no linter configured.

## Architecture (data flow)
Every user action becomes a **signed Nostr event** → published via
`useApp().publish(kind, content, tags)` (signs with the logged-in user's secret
key) → sent to **real relays** (config/settings.js) AND kept in a local cache in
`src/nostr/relay.js`. The cache lets screens keep reading events **synchronously**
with `relay.query()`. Incoming events from relays flow into the same cache and
bump `liveTick` so screens re-render. Shared UI state lives in one context,
`src/state/AppContext.jsx` (`useApp()`). No router: `src/App.jsx` maps a `view`
string → a screen component; `BottomNav` switches `view`. Each screen is wrapped
in an `ErrorBoundary` so one screen's crash can't blank the whole app.

## Directory map
```
src/
  App.jsx                 # SCREENS map + auth gate (view -> component)
  theme.js                # colors/gradients (THEME object)
  config/settings.js      # tunables: MATCH_RADIUS_MILES, DEFAULT_NOTIFY_RADIUS_MILES, USE_DEMO_DATA, CONTACT_PLATFORMS
  config/relays.js        # relay list source of truth: DEFAULT_RELAYS (5 reputable free relays), getRelays/setRelays/onRelaysChange/useRelays, getSetting/setSetting — persisted to localStorage, editable in Account + login
  nostr/
    eventKinds.js         # EVENT_KINDS constants
    keys.js               # REAL keys via nostr-tools: generateKeypair, keypairFromNsec, shortNpub
    events.js             # createNostrEvent (unsigned, demo/local cache) + buildSignedEvent (REAL signed, via finalizeEvent, for relays)
    relay.js              # REAL relays (SimplePool) + local cache: publish (cache+relays), publishLocal (cache only, demo), query (sync, from cache), onEvent, startSync
    replaceable.js        # latestVersions(): collapse replaceable events by (kind,pubkey,d-tag)
    profiles.js           # getProfile(pubkey) -> {name, comm}
    wallet.js             # REAL NIP-47 client: parseNwcUri, getBalance, listTransactions, payInvoice, makeInvoice (talks to the user's wallet over their relay)
    live.js               # REAL relays (SimplePool) for live location: publishPresence/subscribePresence (public, coarsened) + publishRideLocation/subscribeRideLocation (NIP-44 encrypted to the matched rider). Ephemeral kinds, not stored.
    demoData.js           # seed users/requests/route (gated by USE_DEMO_DATA)
  lib/
    geo.js                # haversineDistance, isNearRoute
    geocode.js            # searchAddress(query) -> [{name,lat,lng}] via Nominatim (OSM)
    routing.js            # getDrivingRoute(points) -> {coordinates,distanceMeters,durationSeconds} via OSRM
    useGeolocation.js     # React hook around navigator.geolocation.watchPosition -> {pos,error}
    locations.js          # SAMPLE_LOCATIONS (map default center + demo data), MAP_BOUNDS
  state/AppContext.jsx    # useApp(); holds user/view/rideRequests/activeRide/notifications/wallet/driverOnline/myPosition/geoError; cancelRequest(); refreshData(); broadcasts presence while online
  ui/
    Screen.jsx            # page wrapper: sticky header, optional onBack, optional right slot
    Button.jsx            # variants: primary | driver | ghost
    MapView.jsx           # REAL map: Leaflet + OSM raster tiles (NO WebGL — works in any browser), draws OSRM driving routes. Props: pickup/dropoff/waypoints/drivers/height. `drivers` mode plots live markers. Use only ONE per screen.
    AddressInput.jsx      # type-to-search address picker via Nominatim geocoding; onSelect({name,lat,lng}). Used by RiderRequest & DriverRoutes.
    LocationRow.jsx       # pickup/dropoff pill
    BottomNav.jsx         # 5 tabs: rider-request, driver-browse, my-rides, driver-routes, profile
    QRCode.jsx            # wraps qrcode.react QRCodeSVG
    ErrorBoundary.jsx     # class component; wraps each screen so a crash shows a fallback, not a blank app
  features/
    auth/AuthScreen.jsx           # generate new key OR import nsec
    rides/RiderRequestScreen.jsx  # create request (Ride tab; default screen)
    rides/DriverBrowseScreen.jsx  # browse open requests (Drive tab)
    rides/DriverOfferScreen.jsx   # submit an offer (sub-screen)
    rides/MyRidesScreen.jsx       # Activity tab: my requests (+Cancel) & my offers
    rides/RiderSelectScreen.jsx   # pick a driver from offers (sub-screen)
    rides/PaymentScreen.jsx       # Lightning payment (SIMULATED)
    rides/RideProgressScreen.jsx  # rider's active ride; complete (rate) / cancel; shows the driver's live location when shared
    rides/DriverActiveRideScreen.jsx # driver's active ride ("driver-active" view); broadcasts encrypted live location to the rider
    routes/DriverRoutesScreen.jsx # recurring routes (Routes tab)
    profile/ProfileScreen.jsx     # the "Account" tab: header + completed-trip count + WalletSection + driver-notify toggle + RelayEditor + KeysSection
    profile/WalletSection.jsx     # NWC connect, balance, history, send/receive
    profile/KeysSection.jsx       # npub + nsec (hidden by default)
```

## Nostr event kinds (`src/nostr/eventKinds.js`)
| Kind | Name | Key tags | Content (JSON) |
|---|---|---|---|
| 0 | METADATA | — | `{name, about, communication[]}` |
| 30078 | RIDE_REQUEST | `d`(id), `t` | `{pickup, dropoff, time, notes, status}` |
| 30079 | RIDE_OFFER | `e`(request), `p`(rider), `t` | `{priceSats, etaMinutes, vehicle, message}` |
| 30080 | RIDE_ACCEPT | `e`(offer), `e`(request), `p`(driver), `t` | `{offerId, requestId}` |
| 30081 | RIDE_CANCEL | `e`(request), `t` | `{requestId, reason}` |
| 30082 | RATING | `p`(ratee), `e`(ride), `t` | `{rating, review, rideId}` |
| 30083 | DRIVER_ROUTE | `d`(id), `t` | `{name, waypoints[], schedule, radiusMiles}` |
| 20100 | PRESENCE (ephemeral) | `t`, `expiration` | `{name, npub, vehicle, lat, lng, ts}` — public, coarsened location |
| 21100 | RIDE_LOCATION (ephemeral) | `p`(rider), `expiration` | NIP-44 encrypted `{lat, lng, ts}` — exact, to rider only |

`status` ∈ `requested | accepted | in_progress | cancelled`.

## Invariants & gotchas (read before editing)
- **Events store `pubkey` as hex**, never npub. Convert for display only via
  `shortNpub(hex)` (keys.js). Public/secret bech32 = `user.npub` / `user.nsec`.
- **Replaceable events**: RIDE_REQUEST and DRIVER_ROUTE carry a `d` tag and are
  "edited" by re-publishing with the same `d`. Always read them through
  `latestVersions()` (already applied in `refreshData`) so old versions don't
  resurface. Cancelling a request re-publishes it with `status:"cancelled"`.
- **Publishing**: user actions go through `useApp().publish(kind, content, tags)`,
  which signs with `user.sk` (`buildSignedEvent`) and sends to relays + cache.
  Demo data uses `relay.publishLocal` (cache only) so it never spams public relays.
  Don't go back to `relay.publish(createNostrEvent(...))` for user actions — real
  relays reject unsigned events.
- **Addressable kinds need unique `d` tags**: kinds 30000–39999 are replaceable by
  (kind, pubkey, d). Offers/accepts/ratings carry a `d` tag scoped to the request
  (`offer-<reqId>`, `accept-<reqId>`, `rating-<rideId>`) so they don't overwrite
  each other on relays. Read replaceable lists through `latestVersions()`.
- **Accept-on-pay**: selecting an offer no longer accepts the ride. RiderSelect just
  sets `activeRide={request,offer,status:"selecting"}` and routes to PaymentScreen, which
  has a "← Back to offers" escape. Only `finishPaid` publishes RIDE_ACCEPT + flips the
  request to `in_progress` (with driverPubkey). So the driver's "Driving Now" appears
  only after the upfront invoice is paid. Cancel in RideProgress now publishes the
  request `cancelled` (+ RIDE_CANCEL) behind a confirm dialog. Reviews under 5 stars
  require a non-empty explanation (rider + driver rating UIs both enforce it).
- **Profiles carry photo + vehicle**: kind-0 metadata now includes `picture` (small
  resized JPEG data URL via lib/image.js) and `vehicle:{picture,plateState,plateNumber,
  year,make,model}`. Account centralises writes through `saveProfile(patch)` (merges into
  `user`, republishes full metadata). On login the context fetches our own profile and
  restores photo/vehicle. `getProfile()` returns `{name,comm,picture,vehicle}`.
- **Drive gating**: `isDriveReady(user)` (lib/profile.js) requires face photo + plate
  state/number + year/make/model. DriverBrowse shows a gating message (and an Account
  shortcut) until ready; vehicle photo is optional.
- **User modal**: tapping any username calls `openProfile(pubkey)` (context state
  `profileModalPubkey`); `ui/UserModal.jsx` renders in App and shows the large photo,
  name, full npub, and role-split reputation. Names are buttons in DriverBrowse +
  RiderSelect.
- **Completion**: tapping "Complete Ride" publishes the `completed` status
  immediately (RideProgress `markCompleted`), so Skipping the rating still completes
  the ride. Both rider and the assigned driver then see it under their respective
  collapsible **Past Rides** / **Past Drives** in Activity (newest first, with the
  completion date/time). Active items (requests, Driving Now, pending offers) stay
  at the top; pending offers resolve via the ride's latest status (by d-tag), so
  they don't get stuck on "Pending".
- **USD**: `btcUsd` (context, fetched from CoinGecko, refreshed every 5 min) +
  `SatsAmount`/`satsToUsd` show a fiat estimate next to sats. Hidden if price fetch
  fails.
- **Profiles**: `relay.fetchProfile(pubkey)` pulls one user's kind-0 on demand
  (used in DriverActiveRide / RideProgress) so counterparties' names can show.
- **App tag (critical)**: our kinds (esp. 30078) are shared with other Nostr apps
  (NIP-78), whose events aren't our JSON. Every event we publish carries
  `["t", APP_TAG]` (APP_TAG = "nostrride", in eventKinds.js); relay reads filter by
  `"#t":[APP_TAG]`; and `relay._ingest` rejects any relay event lacking the tag or
  with non-JSON content. Our own writes go through `_store` (trusted). Don't remove
  the tag from `publish()`/live.js or screens will ingest junk and crash on parse.
- **Relays are user-editable + persisted**: the list lives in `config/relays.js`
  (localStorage), edited via `RelayEditor` in both the login screen (collapsed)
  and Account. `relay.js` and `live.js` read `getRelays()` and re-subscribe on
  `onRelaysChange`, so edits take effect live. Defaults are the 5 free relays in DEFAULT_RELAYS (no paid relays).
- **Refresh = pull from relays**: `relay.fetchRecent()` (SimplePool `querySync`)
  pulls recent app events into the cache; exposed as `pullRecent()` in context.
  The Drive screen calls it on open, on the Refresh button, and on a 12s poll, so
  other people's requests appear even if the live subscription missed them.
- **Activity tab**: my requests sorted newest-first; a request with status
  `cancelled` is hidden 24h after its cancel time (`created_at`), with a note on
  the card telling the user it will disappear.
- **Trips = completed only**: the Account trip count is RIDE_REQUESTs whose latest
  version has `status: "completed"` and where the user is the rider (author) or the
  assigned driver (`driverPubkey`). Completion is published when the rider finishes
  (RideProgress `handleSubmitRating`). Don't count raw requests/offers.
- **Driver nearby-request badge**: `notifyNearby`/`notifyRadius` (persisted via
  getSetting/setSetting) enable geolocation; `nearbyRequestCount` in context =
  open ("requested") requests within radius of the driver, not their own. Shown as
  a badge on the Drive tab in BottomNav; it clears automatically when a request is
  cancelled or taken (status leaves "requested").
- **No StrictMode** (see main.jsx): it double-mounts the map in dev and caused
  crashes. Keep it off.
- **`createNostrEvent` does NOT sign** — only for demo/local cache, which isn't
  verified. User-facing events must be signed (above).
- **Wallet is live, not faked**: balance/transactions come from the user's real
  wallet over NIP-47. A working NWC string from a real wallet (Alby Hub, Coinos,
  etc.) is required; otherwise the UI shows a connection error, never fake data.
- **`driverOnline`** (context) is a presence toggle on the Drive tab. It is
  display-only today (the nearby-drivers map isn't built). It must NOT gate the
  ability to make offers.
- **Maps/geocoding/routing use free public dev endpoints**: OSM tiles,
  Nominatim (geocode.js), OSRM (routing.js). These are rate-limited and not for
  production — swap to paid/self-hosted services (keep the return shapes). Render
  only ONE `<MapView>` at a time; each uses a WebGL context, so never put one in
  a list row (that's why DriverBrowse cards show text, not maps).
- **The whole app is on REAL relays now** (`nostr/relay.js` + `nostr/live.js`).
  Ride requests/offers/accepts/ratings/routes AND live location all sync across
  devices. The local cache is just a fast read layer + offline fallback. Presence
  location is COARSENED (~100 m); exact location is only sent NIP-44-encrypted to
  the matched rider. Geolocation needs https:// or localhost.
- **Active-ride live tracking (end-to-end)**: after a rider accepts a driver's
  offer, the driver gets a "Driving Now" card in My Activity → opens
  `DriverActiveRideScreen`, which broadcasts the driver's exact location encrypted
  to the rider (NIP-44, ephemeral kind 21100) every ~6s. The rider's
  `RideProgressScreen` subscribes (`subscribeRideLocation`) and shows the driver
  moving on a live map. Driver finds the rider via the request author pubkey; rider
  finds the driver via `activeRide.offer.pubkey`.
- **Public visibility**: ride requests/offers are public on the relays (anyone on
  those relays can read them) — inherent to the open model. Remote users' display
  names won't show unless we fetch their kind-0 metadata (we don't sync the global
  kind-0 firehose), so they appear as `shortNpub`. The logged-in user and demo
  users show names fine.
- **No persistence**: reloading the page logs the user out and clears the local cache.
- **Tailwind via CDN** → arbitrary/dynamic class strings work, but there is no
  build-time purge. Keep using `THEME` (theme.js) for gradients/bg colors.
- Semantic colors: emerald=pickup, rose=dropoff, amber=driver/offers, cyan=primary/rider.

## "Going live" swap points (each isolated to one file)
- Real relays: **already real** for the whole app (`nostr/relay.js`, SimplePool +
  cache). To harden for production: scope relays/geography, add reconnection, and
  fetch remote kind-0 metadata for display names.
- Real signing: **already real** — `buildSignedEvent` (`nostr/events.js`) via
  `finalizeEvent`, used by `useApp().publish`.
- Real map: **already real** — Leaflet + OSM raster tiles (no WebGL) + OSRM routing
  (`ui/MapView.jsx`, `lib/geocode.js`, `lib/routing.js`).
- Real Lightning: **already real** via NIP-47 in `nostr/wallet.js` (kinds 23194/23195).
  The *ride* payment in `rides/PaymentScreen.jsx` is still simulated (no invoice is
  exchanged between rider/driver yet) — wire it to `payInvoice` once that exists.

## Adding a screen
1. Create `src/features/<area>/<Name>Screen.jsx` (wrap content in `<Screen>`).
2. Import it in `src/App.jsx` and add one entry to `SCREENS`.
3. Navigate with `useApp().setView("<view-id>")`.
4. Top-level tab? add it to `items` in `ui/BottomNav.jsx` (and omit `onBack`).

## Conventions
- One feature per folder; files stay under ~300 lines; each starts with a
  comment block explaining its purpose.
- Don't introduce a state library, router, or CSS framework build step.
- Don't commit secrets. `user.nsec`/`user.sk` are in-memory only.
