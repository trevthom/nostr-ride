// ════════════════════════════════════════════════════════════
//  DRIVER ACTIVE RIDE — Shown to the DRIVER once a rider has accepted
//  their offer. While "Share my location" is on, the driver's exact
//  GPS position is broadcast to the matched rider every few seconds,
//  end-to-end encrypted (NIP-44, ephemeral kind 21100). The rider sees
//  it move live on their "Ride In Progress" screen.
// ════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react";
import { useApp } from "../../state/AppContext.jsx";
import { useGeolocation } from "../../lib/useGeolocation.js";
import { publishRideLocation } from "../../nostr/live.js";
import { relay } from "../../nostr/relay.js";
import { EVENT_KINDS } from "../../nostr/eventKinds.js";
import { getProfile } from "../../nostr/profiles.js";
import { fullNpub } from "../../nostr/keys.js";
import { THEME } from "../../theme.js";
import Screen from "../../ui/Screen.jsx";
import Button from "../../ui/Button.jsx";
import MapView from "../../ui/MapView.jsx";

const SEND_EVERY_MS = 6000;

export default function DriverActiveRideScreen() {
  const { user, setView, selectedRequest, publish, refreshData, openProfile } = useApp();
  const [sharing, setSharing] = useState(true);
  const [lastSent, setLastSent] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [endReason, setEndReason] = useState("completed");
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const { pos, error } = useGeolocation(sharing);
  const posRef = useRef(null);

  useEffect(() => { posRef.current = pos; }, [pos]);

  const riderPubkey = selectedRequest?.pubkey;

  // Pull the rider's profile so we can show their name (if any).
  useEffect(() => { if (riderPubkey) relay.fetchProfile(riderPubkey); }, [riderPubkey]);

  // Broadcast encrypted location to the rider on an interval.
  useEffect(() => {
    if (!sharing || !riderPubkey || !user) return;
    const beat = () => {
      if (posRef.current) {
        publishRideLocation(user, riderPubkey, posRef.current);
        setLastSent(Date.now());
      }
    };
    beat();
    const id = setInterval(beat, SEND_EVERY_MS);
    return () => clearInterval(id);
  }, [sharing, riderPubkey, user]);

  if (!selectedRequest) return null;
  const req = JSON.parse(selectedRequest.content);
  const riderProfile = getProfile(riderPubkey);

  // Driver completes the ride → publish a RIDE_COMPLETE (the rider's screen
  // reacts to it). Then offer an OPTIONAL review of the rider.
  const handleComplete = () => {
    publish(
      EVENT_KINDS.RIDE_COMPLETE,
      { requestId: selectedRequest.id },
      [["e", selectedRequest.id], ["p", riderPubkey], ["d", "complete-" + selectedRequest.id], ["t", "ride-complete"]]
    );
    refreshData();
    setEndReason("completed");
    setShowRating(true);
  };

  // Driver cancels → publish a RIDE_CANCEL, then an OPTIONAL rider review.
  const handleCancel = () => {
    publish(
      EVENT_KINDS.RIDE_CANCEL,
      { requestId: selectedRequest.id, reason: "Cancelled by driver" },
      [["e", selectedRequest.id], ["p", riderPubkey], ["d", "cancel-" + selectedRequest.id], ["t", "ride-cancel"]]
    );
    refreshData();
    setEndReason("cancelled");
    setShowRating(true);
  };

  const submitRating = () => {
    publish(
      EVENT_KINDS.RATING,
      { rating, review, rideId: selectedRequest.id },
      [["p", riderPubkey], ["e", selectedRequest.id], ["d", "rating-" + selectedRequest.id], ["t", "rating"]]
    );
    setView("my-rides");
  };

  // ── Optional review sub-view (after complete/cancel) ──
  if (showRating) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: THEME.pageBg }}>
        <div className="w-full max-w-sm text-center">
          <h2 className="text-white text-xl font-bold mb-1 font-display">
            {endReason === "completed" ? "Ride completed" : "Ride cancelled"}
          </h2>
          <p className="text-white/40 text-sm mb-6">Leave an optional review for your rider.</p>
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} onClick={() => setRating(star)} className={`text-3xl ${star <= rating ? "text-amber-400" : "text-white/20"}`}>★</button>
            ))}
          </div>
          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder={rating < 5 ? "Please explain (required under 5 stars)" : "How was the rider? (optional)"}
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50 text-sm resize-none mb-2"
          />
          {rating < 5 && !review.trim() && (
            <p className="text-amber-400/80 text-xs mb-3">An explanation is required for ratings under 5 stars.</p>
          )}
          <Button onClick={submitRating} disabled={rating < 5 && !review.trim()}>Submit Review</Button>
          <button onClick={() => setView("my-rides")} className="w-full py-3 text-white/40 text-sm mt-2">Skip</button>
        </div>
      </div>
    );
  }

  return (
    <Screen title="Active Ride" onBack={() => setView("my-rides")}>
      <div className="space-y-4">
        <MapView pickup={req.pickup} dropoff={req.dropoff} />

        <button
          onClick={() => riderPubkey && openProfile(riderPubkey)}
          className="w-full text-left bg-white/5 rounded-xl border border-white/10 p-4 hover:border-cyan-500/30 transition-colors"
        >
          <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Rider</p>
          {riderProfile?.name && <p className="text-white font-bold text-sm">{riderProfile.name}</p>}
          <p className="text-white/50 text-xs font-mono break-all">{fullNpub(riderPubkey)}</p>
          <p className="text-white/40 text-sm mt-2">{req.pickup.name} → {req.dropoff.name}</p>
          <span className="text-cyan-400 text-xs">View profile →</span>
        </button>

        {/* Location sharing control */}
        <div
          className="rounded-2xl border p-4 flex items-center gap-3"
          style={{
            background: sharing
              ? "linear-gradient(135deg, rgba(6,182,212,0.12), rgba(16,185,129,0.06))"
              : "rgba(255,255,255,0.02)",
            borderColor: sharing ? "rgba(6,182,212,0.3)" : "rgba(255,255,255,0.1)",
          }}
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${sharing ? "bg-cyan-400 animate-pulse" : "bg-white/20"}`} />
              <p className="text-white font-semibold text-sm">
                {sharing ? "Sharing your live location" : "Location sharing off"}
              </p>
            </div>
            <p className="text-white/40 text-xs mt-0.5">
              {error
                ? error
                : !pos && sharing
                ? "Getting your location…"
                : sharing && lastSent
                ? `Sent to rider · ${new Date(lastSent).toLocaleTimeString()}`
                : "The rider sees your car move in real time."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSharing((v) => !v)}
            aria-pressed={sharing}
            style={{
              flexShrink: 0,
              padding: "10px 16px",
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              color: sharing ? "#ffffff" : "#0e7490",
              background: sharing ? "rgba(255,255,255,0.12)" : "#22d3ee",
            }}
          >
            {sharing ? "Stop" : "Share"}
          </button>
        </div>

        <p className="text-white/30 text-xs text-center px-4">
          Your exact location is encrypted and only the rider can read it.
        </p>

        <div className="flex gap-3">
          <Button onClick={handleComplete} className="flex-1">Complete Ride</Button>
          <button
            onClick={() => setConfirmCancel(true)}
            className="py-3 px-5 rounded-xl font-semibold text-rose-400 text-sm border border-rose-500/20 bg-rose-500/5"
          >
            Cancel Ride
          </button>
        </div>
      </div>

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-xs rounded-2xl border border-white/10 p-5 text-center" style={{ background: "#0b1220" }}>
            <p className="text-white font-semibold mb-1">Cancel this ride?</p>
            <p className="text-white/40 text-sm mb-4">This ends the ride for both you and the rider.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmCancel(false)} className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-white/10 text-white">
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
