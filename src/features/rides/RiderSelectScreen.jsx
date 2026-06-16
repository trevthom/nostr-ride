// ════════════════════════════════════════════════════════════
//  RIDER SELECT — Shows all offers for a request. Accepting one
//  publishes a Kind 30080 accept, marks the request in_progress,
//  and moves the rider to payment.
// ════════════════════════════════════════════════════════════

import { useEffect } from "react";
import { useApp } from "../../state/AppContext.jsx";
import { relay } from "../../nostr/relay.js";
import { EVENT_KINDS } from "../../nostr/eventKinds.js";
import { getProfile } from "../../nostr/profiles.js";
import { shortNpub } from "../../nostr/keys.js";
import { latestVersions } from "../../nostr/replaceable.js";
import { satsToUsd, formatUsd } from "../../ui/SatsAmount.jsx";
import { THEME } from "../../theme.js";
import Screen from "../../ui/Screen.jsx";

// "~$X.XX" for a sats amount (empty when price unknown).
function priceUsd(sats, btcUsd) {
  const usd = satsToUsd(sats, btcUsd);
  return usd != null ? "~" + formatUsd(usd) : "";
}

export default function RiderSelectScreen() {
  const { user, publish, setView, selectedRequest, refreshData, setActiveRide, liveTick } = useApp();

  if (!selectedRequest) return null;
  const req = JSON.parse(selectedRequest.content);
  // latestVersions collapses a driver re-offering the same request; liveTick
  // is referenced so new offers arriving over relays re-run this read.
  void liveTick;
  const offers = latestVersions(relay.query({ kinds: [EVENT_KINDS.RIDE_OFFER], "#e": [selectedRequest.id] }));

  const handleAccept = (offer) => {
    // Don't publish acceptance yet — the trip isn't accepted until the
    // fare/deposit is paid. Just carry the selection to the payment screen;
    // the rider can still back out from there.
    setActiveRide({ request: selectedRequest, offer, status: "selecting" });
    setView("payment");
  };

  return (
    <Screen title="Select a Driver" onBack={() => setView("my-rides")}>
      <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-4">
        <div className="text-sm text-white/80 mb-1">{req.pickup.name} → {req.dropoff.name}</div>
        <div className="text-white/30 text-xs">{req.time === "ASAP" ? "ASAP" : new Date(req.time).toLocaleString()}</div>
      </div>

      <p className="text-white/30 text-xs uppercase tracking-widest mb-3">
        {offers.length} offer{offers.length !== 1 ? "s" : ""} received
      </p>

      {offers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/30 text-sm">No offers yet. Waiting for drivers...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} onAccept={() => handleAccept(offer)} />
          ))}
        </div>
      )}
    </Screen>
  );
}

// One driver offer with price, ETA, rating, and an Accept button.
function OfferCard({ offer, onAccept }) {
  const { btcUsd, openProfile } = useApp();
  useEffect(() => { relay.fetchProfile(offer.pubkey); }, [offer.pubkey]);
  const c = JSON.parse(offer.content);
  const profile = getProfile(offer.pubkey);
  const ratings = relay.query({ kinds: [EVENT_KINDS.RATING], "#p": [offer.pubkey] });
  const ratingVals = ratings
    .map((r) => { try { return JSON.parse(r.content).rating; } catch { return null; } })
    .filter((v) => typeof v === "number");
  const avgRating = ratingVals.length > 0 ? (ratingVals.reduce((s, v) => s + v, 0) / ratingVals.length).toFixed(1) : null;

  return (
    <div
      className="rounded-2xl border border-white/10 p-4 space-y-3"
      style={{ background: "linear-gradient(180deg, rgba(251,191,36,0.04), rgba(255,255,255,0.01))" }}
    >
      <div className="flex items-center gap-3">
        {profile?.picture ? (
          <img src={profile.picture} alt={profile?.name || "Driver"} className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm">
            {(profile?.name || "?")[0]}
          </div>
        )}
        <div className="flex-1">
          <button onClick={() => openProfile(offer.pubkey)} className="text-white font-medium text-sm hover:text-cyan-400 text-left">{profile?.name || shortNpub(offer.pubkey)}</button>
          <p className="text-white/30 text-xs">
            {profile?.vehicle && (profile.vehicle.make || profile.vehicle.model)
              ? [profile.vehicle.year, profile.vehicle.make, profile.vehicle.model].filter(Boolean).join(" ")
              : "Tap name for details"}
          </p>
        </div>
        {avgRating && <span className="text-amber-400 text-xs font-medium">★ {avgRating}</span>}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <div>
            <p className="text-white/30 text-xs">Price</p>
            <p className="text-white font-semibold text-lg">
              {c.priceSats} <span className="text-xs text-amber-400">sats</span>
            </p>
            <p className="text-white/30 text-[11px]">{priceUsd(c.priceSats, btcUsd)}</p>
            {c.upfrontSats > 0 && (
              <p className="text-amber-400/80 text-[11px] mt-0.5">
                {c.upfrontSats} sats due now {priceUsd(c.upfrontSats, btcUsd) && `(${priceUsd(c.upfrontSats, btcUsd)})`}
              </p>
            )}
          </div>
          <Stat label="ETA" value={c.etaMinutes} unit="min" unitColor="text-white/40" />
        </div>
        <button
          onClick={onAccept}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
          style={{ background: THEME.brandGradient }}
        >
          Accept
        </button>
      </div>

      {profile?.comm?.length > 0 && (
        <p className="text-white/20 text-xs">
          Contact: {profile.comm.map((m) => `${m.platform}: ${m.handle}`).join(", ")}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, unit, unitColor }) {
  return (
    <div>
      <p className="text-white/30 text-xs">{label}</p>
      <p className="text-white font-semibold text-lg">
        {value} <span className={`text-xs ${unitColor}`}>{unit}</span>
      </p>
    </div>
  );
}
