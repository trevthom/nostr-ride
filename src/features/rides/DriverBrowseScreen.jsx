// ════════════════════════════════════════════════════════════
//  DRIVER BROWSE — Lists every open ride request from the relay so
//  a driver can pick one to make an offer on.
// ════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { useApp } from "../../state/AppContext.jsx";
import { relay } from "../../nostr/relay.js";
import { EVENT_KINDS } from "../../nostr/eventKinds.js";
import { getProfile } from "../../nostr/profiles.js";
import { shortNpub } from "../../nostr/keys.js";
import { subscribePresence } from "../../nostr/live.js";
import { haversineDistance } from "../../lib/geo.js";
import { isRideExpired, reputation, rideStatus } from "../../lib/rides.js";
import { isDriveReady, missingDriveInfo } from "../../lib/profile.js";
import Screen from "../../ui/Screen.jsx";
import MapView from "../../ui/MapView.jsx";

const SORTS = [
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "shortest", label: "Shortest trip" },
  { id: "longest", label: "Longest trip" },
];

export default function DriverBrowseScreen() {
  const { user, setView, rideRequests, setSelectedRequest, pullRecent, driverOnline, setDriverOnline, setLocating, myPosition, geoError } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState("newest");
  const driveReady = isDriveReady(user);

  // Subscribe to other online drivers (real relays) while on this screen.
  const [otherDrivers, setOtherDrivers] = useState([]);
  useEffect(() => {
    const unsub = subscribePresence(setOtherDrivers, { excludePubkey: user.publicKey });
    return unsub;
  }, [user.publicKey]);

  // Pull requests from relays on open, then poll so others' requests appear.
  useEffect(() => {
    pullRecent();
    const id = setInterval(() => pullRecent(), 12000);
    return () => clearInterval(id);
  }, [pullRecent]);

  // Warm up GPS while on this tab so "Go online" can require a real fix.
  useEffect(() => {
    setLocating(true);
    return () => setLocating(false);
  }, [setLocating]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await pullRecent();
    setRefreshing(false);
  };

  // Drivers to plot: everyone else, plus you when you're online with a fix.
  const mapDrivers = [...otherDrivers];
  if (driverOnline && myPosition) {
    mapDrivers.push({ pubkey: user.publicKey, lat: myPosition.lat, lng: myPosition.lng, name: "You", self: true });
  }

  // Show only requests that haven't started yet and haven't expired.
  const transitMiles = (c) => haversineDistance(c.pickup.lat, c.pickup.lng, c.dropoff.lat, c.dropoff.lng);
  const openRequests = rideRequests
    .filter((r) => {
      const c = JSON.parse(r.content);
      if (rideStatus(r) !== "requested") return false; // hide started/ended rides
      return !isRideExpired(c, r.created_at); // hide expired open requests
    })
    .sort((a, b) => {
      const ca = JSON.parse(a.content), cb = JSON.parse(b.content);
      if (sort === "newest") return b.created_at - a.created_at;
      if (sort === "oldest") return a.created_at - b.created_at;
      if (sort === "shortest") return transitMiles(ca) - transitMiles(cb);
      if (sort === "longest") return transitMiles(cb) - transitMiles(ca);
      return 0;
    });

  const handleOffer = (request) => {
    setSelectedRequest(request);
    setView("driver-offer");
  };

  return (
    <Screen
      title="Available Rides"
      right={
        driveReady ? (
          <button onClick={handleRefresh} disabled={refreshing} className="text-cyan-400 text-xs disabled:opacity-50">
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        ) : null
      }
    >
      {!driveReady ? (
        <div className="pt-16 text-center px-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 flex items-center justify-center mx-auto mb-4 text-3xl">🚧</div>
          <p className="text-white text-lg font-semibold mb-2">Driving isn't available yet</p>
          <p className="text-white/50 text-sm leading-relaxed">
            To offer rides, add your {missingDriveInfo(user).join(", ")} in the Account tab. Once your
            photo and vehicle details are saved, the Drive tab will become available.
          </p>
          <button
            onClick={() => setView("profile")}
            className="mt-5 px-5 py-2.5 rounded-xl text-sm font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30"
          >
            Go to Account →
          </button>
        </div>
      ) : (
        <>
          <OnlineToggle
            online={driverOnline}
            canGoOnline={!!myPosition}
            geoError={geoError}
            onToggle={() => {
              if (!driverOnline && !myPosition) return; // need a real fix to go online
              setDriverOnline((v) => !v);
            }}
          />

          <LiveDrivers
            drivers={mapDrivers}
            otherCount={otherDrivers.length}
            online={driverOnline}
            myPosition={myPosition}
            geoError={geoError}
          />

          {openRequests.length === 0 ? (
            <div className="pt-20 text-center">
              <p className="text-white/30 text-lg mb-2">No ride requests yet</p>
              <p className="text-white/20 text-sm">New requests appear here via Nostr subscriptions.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-white/30 text-xs shrink-0">Sort:</span>
                {SORTS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSort(s.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs shrink-0 ${
                      sort === s.id
                        ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                        : "bg-white/5 text-white/40 border border-white/10"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {openRequests.map((req) => (
                <RequestCard
                  key={req.id}
                  req={req}
                  isMine={req.pubkey === user.publicKey}
                  onOffer={() => handleOffer(req)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </Screen>
  );
}

// A single ride-request card with map, route, and an Offer button.
function RequestCard({ req, isMine, onOffer }) {
  const { openProfile } = useApp();
  const c = JSON.parse(req.content);
  const profile = getProfile(req.pubkey);
  const rep = reputation(req.pubkey);
  const dist = haversineDistance(c.pickup.lat, c.pickup.lng, c.dropoff.lat, c.dropoff.lng);
  const offerCount = relay.query({ kinds: [EVENT_KINDS.RIDE_OFFER], "#e": [req.id] }).length;

  return (
    <div
      className="rounded-2xl border border-white/10 overflow-hidden"
      style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))" }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <button onClick={() => openProfile(req.pubkey)} className="text-white font-medium text-sm hover:text-cyan-400 text-left">
              {profile?.name || shortNpub(req.pubkey)}
            </button>
            {/* Rider's reputation so the driver can judge the request */}
            <p className="text-white/40 text-xs">
              🚗 {rep.rides} ride{rep.rides === 1 ? "" : "s"}
              {rep.riderReviews.count > 0
                ? ` · ★ ${rep.riderReviews.avg.toFixed(1)} (${rep.riderReviews.count} review${rep.riderReviews.count === 1 ? "" : "s"})`
                : " · no reviews yet"}
            </p>
            <p className="text-white/30 text-xs">
              {c.time === "ASAP" ? "ASAP" : new Date(c.time).toLocaleString()}
            </p>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              c.status === "requested" ? "bg-cyan-500/15 text-cyan-400" : "bg-amber-500/15 text-amber-400"
            }`}
          >
            {c.status}
            {offerCount > 0 ? ` · ${offerCount} offer${offerCount > 1 ? "s" : ""}` : ""}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          <span className="text-white/60">{c.pickup.name}</span>
          <span className="text-white/20">→</span>
          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
          <span className="text-white/60">{c.dropoff.name}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-white/30 text-xs">{dist.toFixed(1)} mi</span>
          {!isMine && (
            <button
              onClick={onOffer}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all active:scale-95"
            >
              Offer Ride
            </button>
          )}
        </div>
        {c.notes && <p className="text-white/20 text-xs italic">"{c.notes}"</p>}
      </div>
    </div>
  );
}

// Online/offline presence toggle. When ON, the driver will appear on
// the nearby-drivers map (coming soon). Turning it OFF does NOT stop
// you from making offers — it only controls map visibility.
function OnlineToggle({ online, onToggle, canGoOnline, geoError }) {
  const blocked = !online && !canGoOnline; // can't go online without a location fix
  return (
    <div
      onClick={blocked ? undefined : onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (!blocked && (e.key === "Enter" || e.key === " ")) onToggle(); }}
      className="rounded-2xl border p-4 mb-4 flex items-center gap-3"
      style={{
        cursor: blocked ? "default" : "pointer",
        background: online
          ? "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,182,212,0.06))"
          : "rgba(255,255,255,0.02)",
        borderColor: online ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.1)",
      }}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${online ? "bg-emerald-400 animate-pulse" : "bg-white/20"}`} />
          <p className="text-white font-semibold text-sm">
            {online ? "You're online" : "You're offline"}
          </p>
        </div>
        <p className="text-white/40 text-xs mt-0.5">
          {online
            ? "Your vehicle is visible to nearby riders."
            : geoError
            ? `${geoError} Location is required to go online.`
            : blocked
            ? "Finding your location… you can go online once it's known."
            : "Tap to go online and share your location."}
        </p>
      </div>

      {/* Explicit labeled button. Inline styles guarantee it has a real
          size and is tappable even before/without Tailwind. */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (!blocked) onToggle(); }}
        disabled={blocked}
        aria-pressed={online}
        style={{
          flexShrink: 0,
          padding: "10px 16px",
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 600,
          border: "none",
          cursor: blocked ? "not-allowed" : "pointer",
          opacity: blocked ? 0.5 : 1,
          color: online ? "#022c22" : "#ffffff",
          background: online ? "#34d399" : "rgba(255,255,255,0.12)",
        }}
      >
        {online ? "Go offline" : blocked ? "Locating…" : "Go online"}
      </button>
    </div>
  );
}

// Live nearby-drivers map + status. Shows other online drivers (from
// real relays) and your own marker when you're online with a GPS fix.
function LiveDrivers({ drivers, otherCount, online, myPosition, geoError }) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-white/40 text-xs uppercase tracking-wider">Nearby Drivers</p>
        <span className="text-white/30 text-xs">
          {otherCount === 0 ? "none online" : `${otherCount} online`}
        </span>
      </div>

      <MapView drivers={drivers} height={220} />

      {/* Status line under the map */}
      {online && geoError && (
        <p className="text-amber-400/80 text-xs mt-2">
          {geoError} You're hidden from the map, but can still offer rides.
        </p>
      )}
      {online && !myPosition && !geoError && (
        <p className="text-white/40 text-xs mt-2">Getting your location…</p>
      )}
      {online && myPosition && (
        <p className="text-emerald-400/80 text-xs mt-2">
          You're live — broadcasting your approximate location to nearby riders.
        </p>
      )}
      {!online && (
        <p className="text-white/30 text-xs mt-2">
          Go online to share your location and appear here for riders.
        </p>
      )}
    </div>
  );
}
