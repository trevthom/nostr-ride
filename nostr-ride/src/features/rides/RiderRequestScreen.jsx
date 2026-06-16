// ════════════════════════════════════════════════════════════
//  RIDER REQUEST — A rider TYPES a pickup and dropoff address
//  (autocomplete), adds details, and publishes a Kind 30078 ride
//  request. The map below is a read-only preview of the route.
// ════════════════════════════════════════════════════════════

import { useState } from "react";
import { useApp } from "../../state/AppContext.jsx";
import { EVENT_KINDS } from "../../nostr/eventKinds.js";
import { haversineDistance } from "../../lib/geo.js";
import { THEME } from "../../theme.js";
import Screen from "../../ui/Screen.jsx";
import Button from "../../ui/Button.jsx";
import MapView from "../../ui/MapView.jsx";
import AddressInput from "../../ui/AddressInput.jsx";

export default function RiderRequestScreen() {
  const { publish, setView, refreshData } = useApp();
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [time, setTime] = useState("ASAP");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!pickup || !dropoff) return;
    if (time !== "ASAP") {
      const t = Date.parse(time);
      if (isNaN(t)) { setError("Please pick a valid date & time."); return; }
      if (t > Date.now() + 7 * 86400000) { setError("Timed rides can be at most 1 week in advance."); return; }
      if (t < Date.now() - 60000) { setError("Pick a time in the future."); return; }
    }
    publish(
      EVENT_KINDS.RIDE_REQUEST,
      { pickup, dropoff, time, notes, status: "requested" },
      [["d", "ride-" + Date.now()], ["t", "ride-request"]]
    );
    setSubmitted(true);
    refreshData();
    setTimeout(() => setView("my-rides"), 1200);
  };

  if (submitted) {
    return <Confirmation />;
  }

  return (
    <Screen title="Request a Ride">
      <div className="space-y-4">
        {/* Address entry (type to search) */}
        <AddressInput
          label="Pickup"
          value={pickup}
          onSelect={setPickup}
          dotColor="bg-emerald-500"
          placeholder="Enter pickup address"
        />
        <AddressInput
          label="Dropoff"
          value={dropoff}
          onSelect={setDropoff}
          dotColor="bg-rose-500"
          placeholder="Enter dropoff address"
        />

        {/* Read-only route preview once both are set */}
        {pickup && dropoff && (
          <>
            <MapView pickup={pickup} dropoff={dropoff} />
            <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex justify-between text-sm">
              <span className="text-white/40">Distance</span>
              <span className="text-white font-medium">
                {haversineDistance(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng).toFixed(1)} mi
              </span>
            </div>
          </>
        )}

        <div>
          <label className="text-xs text-white/40 uppercase tracking-wider mb-1 block">When</label>
          <div className="flex gap-2">
            {["ASAP", "Timed"].map((opt) => {
              const isTimed = time !== "ASAP";
              const active = (opt === "ASAP" && time === "ASAP") || (opt === "Timed" && isTimed);
              return (
                <button
                  key={opt}
                  onClick={() =>
                    setTime(
                      opt === "ASAP"
                        ? "ASAP"
                        // default to 1 hour out, formatted for <input type="datetime-local">
                        : new Date(Date.now() + 3600000 - new Date().getTimezoneOffset() * 60000)
                            .toISOString()
                            .slice(0, 16)
                    )
                  }
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                      : "bg-white/5 text-white/40 border border-white/10"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {time !== "ASAP" && (
            <div className="mt-2">
              <label className="text-xs text-white/40 mb-1 block">Pick-up time</label>
              <input
                type="datetime-local"
                value={time}
                min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                max={new Date(Date.now() + 7 * 86400000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                onChange={(e) => { setTime(e.target.value || "ASAP"); setError(""); }}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                style={{ colorScheme: "dark" }}
              />
              <p className="text-white/30 text-[11px] mt-1">Up to 1 week ahead. Expires 1 hour after the pick-up time.</p>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-white/40 uppercase tracking-wider mb-1 block">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Luggage, accessibility needs, etc."
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50 text-sm resize-none"
          />
        </div>

        {error && <p className="text-rose-400 text-xs">{error}</p>}

        <Button onClick={handleSubmit} disabled={!pickup || !dropoff}>
          Publish Ride Request ⚡
        </Button>
      </div>
    </Screen>
  );
}

function Confirmation() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: THEME.pageBg }}>
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4 text-4xl">✓</div>
        <h2 className="text-white text-xl font-bold mb-2">Request Published</h2>
        <p className="text-white/40 text-sm">Broadcasted to Nostr. Drivers will see it now.</p>
      </div>
    </div>
  );
}
