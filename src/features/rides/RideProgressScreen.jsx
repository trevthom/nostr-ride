// ════════════════════════════════════════════════════════════
//  RIDE IN PROGRESS (RIDER) — The rider can only CANCEL the ride here.
//  The DRIVER is the one who completes it. When the driver completes or
//  cancels (or the rider cancels), this screen flips to an OPTIONAL
//  review of the driver (with Skip). Driver location shows live if shared.
// ════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react";
import { useApp } from "../../state/AppContext.jsx";
import { relay } from "../../nostr/relay.js";
import { EVENT_KINDS } from "../../nostr/eventKinds.js";
import { getProfile } from "../../nostr/profiles.js";
import { subscribeRideLocation } from "../../nostr/live.js";
import { rideStatus, rideEnding } from "../../lib/rides.js";
import { THEME } from "../../theme.js";
import Screen from "../../ui/Screen.jsx";
import Button from "../../ui/Button.jsx";
import MapView from "../../ui/MapView.jsx";

const dtagOf = (e) => (e.tags.find((t) => t[0] === "d") || [])[1];

export default function RideProgressScreen() {
  const { user, publish, setView, activeRide, setActiveRide, refreshData, openProfile, pullRecent, pushNotice } = useApp();
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [driverLoc, setDriverLoc] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const vehRef = useRef(null);

  const driverPubkey = activeRide?.offer?.pubkey;

  useEffect(() => {
    if (!driverPubkey) return;
    relay.fetchProfile(driverPubkey);
    const unsub = subscribeRideLocation(user, driverPubkey, (loc) => setDriverLoc(loc));
    return unsub;
  }, [driverPubkey, user]);

  // Poll so a driver's complete/cancel shows up here promptly.
  useEffect(() => {
    const id = setInterval(() => pullRecent(), 7000);
    return () => clearInterval(id);
  }, [pullRecent]);

  if (!activeRide) return null;
  const req = JSON.parse(activeRide.request.content);

  // Latest version of this request (for derived status).
  const d = dtagOf(activeRide.request);
  const versions = relay.query({ kinds: [EVENT_KINDS.RIDE_REQUEST] }).filter((e) => dtagOf(e) === d);
  const liveReq = versions.sort((a, b) => b.created_at - a.created_at)[0] || activeRide.request;
  const status = rideStatus(liveReq);
  const ending = rideEnding(liveReq);
  const ended = status === "completed" || status === "cancelled";

  const driver = driverPubkey ? getProfile(driverPubkey) : null;

  // Notify the rider if the driver changes vehicle details mid-ride.
  const vehStr = JSON.stringify(driver?.vehicle || null);
  useEffect(() => {
    if (!driver?.vehicle) return;
    if (vehRef.current === null) { vehRef.current = vehStr; return; }
    if (vehStr !== vehRef.current) { vehRef.current = vehStr; pushNotice("Your driver updated their vehicle details."); }
  }, [vehStr]); // eslint-disable-line

  const handleCancel = () => {
    publish(
      EVENT_KINDS.RIDE_CANCEL,
      { requestId: liveReq.id, reason: "Cancelled by rider" },
      [["e", liveReq.id], ["p", driverPubkey].filter(Boolean), ["d", "cancel-" + liveReq.id], ["t", "ride-cancel"]].filter((t) => t.length >= 2)
    );
    refreshData();
  };

  const submitRating = () => {
    if (driverPubkey) {
      publish(
        EVENT_KINDS.RATING,
        { rating, review, rideId: liveReq.id },
        [["p", driverPubkey], ["e", liveReq.id], ["d", "rating-" + liveReq.id], ["t", "rating"]]
      );
    }
    setActiveRide(null);
    refreshData();
    setView("my-rides");
  };

  const leave = () => { setActiveRide(null); refreshData(); setView("my-rides"); };

  // ── Ended → optional review of the driver ──
  if (ended) {
    const byRider = ending?.by === user.publicKey;
    const heading = status === "completed" ? "Ride completed" : byRider ? "Ride cancelled" : "Ride cancelled by driver";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: THEME.pageBg }}>
        <div className="w-full max-w-sm text-center">
          <h2 className="text-white text-xl font-bold mb-1 font-display">{heading}</h2>
          <p className="text-white/40 text-sm mb-6">Leave an optional review for your driver.</p>
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} onClick={() => setRating(star)} className={`text-3xl ${star <= rating ? "text-amber-400" : "text-white/20"}`}>★</button>
            ))}
          </div>
          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder={rating < 5 ? "Please explain (required under 5 stars)" : "How was the ride? (optional)"}
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50 text-sm resize-none mb-2"
          />
          {rating < 5 && !review.trim() && (
            <p className="text-amber-400/80 text-xs mb-3">An explanation is required for ratings under 5 stars.</p>
          )}
          <Button onClick={submitRating} disabled={rating < 5 && !review.trim()}>Submit Review</Button>
          <button onClick={leave} className="w-full py-3 text-white/40 text-sm mt-2">Skip</button>
        </div>
      </div>
    );
  }

  // ── In-progress view (rider) ──
  const offer = activeRide.offer ? JSON.parse(activeRide.offer.content) : null;

  return (
    <Screen title="Ride In Progress">
      <div className="space-y-4">
        <MapView pickup={req.pickup} dropoff={req.dropoff} />

        {driverLoc && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <p className="text-cyan-400 text-xs uppercase tracking-wider">Driver location (live)</p>
              <span className="text-white/30 text-[10px] ml-auto">updated {new Date(driverLoc.ts).toLocaleTimeString()}</span>
            </div>
            <MapView drivers={[{ pubkey: driverPubkey, lat: driverLoc.lat, lng: driverLoc.lng, name: "Driver" }]} height={200} />
          </div>
        )}

        <div className="bg-emerald-500/10 rounded-2xl border border-emerald-500/20 p-5 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <p className="text-emerald-400 font-semibold">In Progress</p>
          <p className="text-white/40 text-sm mt-1">{req.pickup.name} → {req.dropoff.name}</p>
          <p className="text-white/30 text-xs mt-2">Your driver will mark the ride complete on arrival.</p>
        </div>

        {driverPubkey && (
          <button
            onClick={() => openProfile(driverPubkey)}
            className="w-full text-left bg-white/5 rounded-xl border border-white/10 p-4 hover:border-cyan-500/30 transition-colors"
          >
            <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Your Driver</p>
            <div className="flex items-center gap-3">
              {driver?.picture ? (
                <img src={driver.picture} alt={driver?.name || "Driver"} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm">
                  {(driver?.name || "D")[0]}
                </div>
              )}
              <div>
                <p className="text-white font-medium text-sm">{driver?.name || "Driver"}</p>
                {driver?.vehicle && (driver.vehicle.make || driver.vehicle.model) && (
                  <p className="text-white/40 text-xs">{[driver.vehicle.year, driver.vehicle.make, driver.vehicle.model].filter(Boolean).join(" ")}</p>
                )}
                {driver?.vehicle?.plateState && driver?.vehicle?.plateNumber && (
                  <p className="text-white/30 text-[11px]">Plate: {driver.vehicle.plateState} · {driver.vehicle.plateNumber}</p>
                )}
              </div>
              <span className="ml-auto text-cyan-400 text-xs">View →</span>
            </div>
          </button>
        )}

        <button
          onClick={() => setConfirmCancel(true)}
          className="w-full py-4 rounded-xl font-semibold text-rose-400 text-sm border border-rose-500/20 bg-rose-500/5"
        >
          Cancel Ride
        </button>
      </div>

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-xs rounded-2xl border border-white/10 p-5 text-center" style={{ background: "#0b1220" }}>
            <p className="text-white font-semibold mb-1">Cancel this ride?</p>
            <p className="text-white/40 text-sm mb-4">Any upfront deposit you paid is non-refundable.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmCancel(false)} className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-white/10 text-white">Keep ride</button>
              <button onClick={() => { setConfirmCancel(false); handleCancel(); }} className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-rose-500/20 text-rose-400 border border-rose-500/30">Cancel ride</button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}
