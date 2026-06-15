// ════════════════════════════════════════════════════════════
//  RIDE IN PROGRESS — Shows the active ride and driver. The rider
//  can Complete (then leave a Kind 30082 rating) or Cancel (a
//  Kind 30081 cancellation).
// ════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { useApp } from "../../state/AppContext.jsx";
import { relay } from "../../nostr/relay.js";
import { EVENT_KINDS } from "../../nostr/eventKinds.js";
import { getProfile } from "../../nostr/profiles.js";
import { subscribeRideLocation } from "../../nostr/live.js";
import { THEME } from "../../theme.js";
import Screen from "../../ui/Screen.jsx";
import Button from "../../ui/Button.jsx";
import MapView from "../../ui/MapView.jsx";

export default function RideProgressScreen() {
  const { user, publish, setView, activeRide, setActiveRide, refreshData } = useApp();
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [driverLoc, setDriverLoc] = useState(null); // live, encrypted, from the driver
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Listen for the matched driver's encrypted live location (if they share it).
  const driverPubkey = activeRide?.offer?.pubkey;
  useEffect(() => {
    if (!driverPubkey) return;
    relay.fetchProfile(driverPubkey); // so we can show the driver's name
    const unsub = subscribeRideLocation(user, driverPubkey, (loc) => setDriverLoc(loc));
    return unsub;
  }, [driverPubkey, user]);

  if (!activeRide) return null;
  const req = JSON.parse(activeRide.request.content);

  // Mark the ride fully completed (status -> completed). Done the moment
  // the rider taps "Complete", so it sticks even if they skip the rating.
  const markCompleted = () => {
    const target = activeRide.offer?.pubkey || req.driverPubkey;
    publish(
      EVENT_KINDS.RIDE_REQUEST,
      { ...req, status: "completed", driverPubkey: target || req.driverPubkey },
      activeRide.request.tags // same "d" tag => replaces the request
    );
  };

  const handleComplete = () => {
    markCompleted();
    setShowRating(true);
  };

  const handleSubmitRating = () => {
    const target = activeRide.offer?.pubkey || req.driverPubkey;
    if (target) {
      publish(
        EVENT_KINDS.RATING,
        { rating, review, rideId: activeRide.request.id },
        [["p", target], ["e", activeRide.request.id], ["d", "rating-" + activeRide.request.id], ["t", "rating"]]
      );
    }
    setActiveRide(null);
    refreshData();
    setView("my-rides");
  };

  // Skip leaves the ride completed (already published above) — just no review.
  const handleSkip = () => {
    setActiveRide(null);
    refreshData();
    setView("my-rides");
  };

  const handleCancel = () => {
    // Fully cancel: mark the request cancelled AND publish a cancel event.
    publish(
      EVENT_KINDS.RIDE_REQUEST,
      { ...req, status: "cancelled" },
      activeRide.request.tags
    );
    publish(
      EVENT_KINDS.RIDE_CANCEL,
      { requestId: activeRide.request.id, reason: "Cancelled by rider" },
      [["e", activeRide.request.id], ["d", "cancel-" + activeRide.request.id], ["t", "ride-cancel"]]
    );
    setActiveRide(null);
    refreshData();
    setView("my-rides");
  };

  // ── Rating sub-view ──
  if (showRating) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: THEME.pageBg }}>
        <div className="w-full max-w-sm text-center">
          <h2 className="text-white text-xl font-bold mb-6 font-display">Rate Your Ride</h2>
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className={`text-3xl transition-all ${star <= rating ? "text-amber-400" : "text-white/20"}`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder={rating < 5 ? "Please explain what went wrong (required)" : "How was the ride? (optional)"}
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50 text-sm resize-none mb-2"
          />
          {rating < 5 && !review.trim() && (
            <p className="text-amber-400/80 text-xs mb-3">A short explanation is required for ratings under 5 stars.</p>
          )}
          <Button onClick={handleSubmitRating} disabled={rating < 5 && !review.trim()}>Submit Rating</Button>
          <button onClick={handleSkip} className="w-full py-3 text-white/40 text-sm mt-2">
            Skip
          </button>
        </div>
      </div>
    );
  }

  // ── Main in-progress view ──
  const driver = activeRide.offer ? getProfile(activeRide.offer.pubkey) : null;
  const offer = activeRide.offer ? JSON.parse(activeRide.offer.content) : null;

  return (
    <Screen title="Ride In Progress">
      <div className="space-y-4">
        <MapView pickup={req.pickup} dropoff={req.dropoff} />

        {/* Appears only when the driver is actually sharing live location */}
        {driverLoc && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <p className="text-cyan-400 text-xs uppercase tracking-wider">Driver location (live)</p>
              <span className="text-white/30 text-[10px] ml-auto">
                updated {new Date(driverLoc.ts).toLocaleTimeString()}
              </span>
            </div>
            <MapView
              drivers={[{ pubkey: driverPubkey, lat: driverLoc.lat, lng: driverLoc.lng, name: "Driver" }]}
              height={200}
            />
          </div>
        )}

        <div className="bg-emerald-500/10 rounded-2xl border border-emerald-500/20 p-5 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <p className="text-emerald-400 font-semibold">In Progress</p>
          <p className="text-white/40 text-sm mt-1">{req.pickup.name} → {req.dropoff.name}</p>
        </div>

        {offer && (
          <div className="bg-white/5 rounded-xl border border-white/10 p-4">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Your Driver</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm">
                {(driver?.name || "D")[0]}
              </div>
              <div>
                <p className="text-white font-medium text-sm">{driver?.name || "Driver"}</p>
                <p className="text-white/30 text-xs">{offer.vehicle}</p>
              </div>
            </div>
            {driver?.comm?.length > 0 && (
              <p className="text-white/30 text-xs mt-2">
                Contact: {driver.comm.map((m) => `${m.platform}: ${m.handle}`).join(", ")}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <Button onClick={handleComplete} className="flex-1">Complete Ride</Button>
          <button onClick={() => setConfirmCancel(true)} className="py-4 px-5 rounded-xl font-semibold text-rose-400 text-sm border border-rose-500/20 bg-rose-500/5">
            Cancel
          </button>
        </div>
      </div>

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-xs rounded-2xl border border-white/10 p-5 text-center" style={{ background: "#0b1220" }}>
            <p className="text-white font-semibold mb-1">Cancel this ride?</p>
            <p className="text-white/40 text-sm mb-4">
              This ends the ride for both you and the driver. Any upfront deposit you paid is non-refundable.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmCancel(false)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-white/10 text-white"
              >
                Keep ride
              </button>
              <button
                onClick={() => { setConfirmCancel(false); handleCancel(); }}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-rose-500/20 text-rose-400 border border-rose-500/30"
              >
                Cancel ride
              </button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}
