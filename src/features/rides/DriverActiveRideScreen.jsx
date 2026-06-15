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
import { getProfile } from "../../nostr/profiles.js";
import { fullNpub } from "../../nostr/keys.js";
import Screen from "../../ui/Screen.jsx";
import Button from "../../ui/Button.jsx";
import MapView from "../../ui/MapView.jsx";

const SEND_EVERY_MS = 6000;

export default function DriverActiveRideScreen() {
  const { user, setView, selectedRequest } = useApp();
  const [sharing, setSharing] = useState(true);
  const [lastSent, setLastSent] = useState(null);
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

  return (
    <Screen title="Active Ride" onBack={() => setView("my-rides")}>
      <div className="space-y-4">
        <MapView pickup={req.pickup} dropoff={req.dropoff} />

        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Rider</p>
          {riderProfile?.name && <p className="text-white font-bold text-sm">{riderProfile.name}</p>}
          <p className="text-white/50 text-xs font-mono break-all">{fullNpub(riderPubkey)}</p>
          <p className="text-white/40 text-sm mt-2">{req.pickup.name} → {req.dropoff.name}</p>
        </div>

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

        <Button variant="ghost" onClick={() => setView("my-rides")}>
          End ride
        </Button>
      </div>
    </Screen>
  );
}
