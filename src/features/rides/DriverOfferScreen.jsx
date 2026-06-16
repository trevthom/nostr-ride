// ════════════════════════════════════════════════════════════
//  DRIVER OFFER — A driver sets price/ETA/vehicle and publishes a
//  Kind 30079 offer that references the chosen ride request.
// ════════════════════════════════════════════════════════════

import { useState } from "react";
import { useApp } from "../../state/AppContext.jsx";
import { EVENT_KINDS } from "../../nostr/eventKinds.js";
import { THEME } from "../../theme.js";
import Screen from "../../ui/Screen.jsx";
import Button from "../../ui/Button.jsx";
import MapView from "../../ui/MapView.jsx";
import { satsToUsd, formatUsd } from "../../ui/SatsAmount.jsx";

export default function DriverOfferScreen() {
  const { publish, setView, selectedRequest, refreshData, btcUsd } = useApp();
  const [price, setPrice] = useState("");
  const [upfront, setUpfront] = useState("");
  const [eta, setEta] = useState("10");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  if (!selectedRequest) return null;
  const req = JSON.parse(selectedRequest.content);
  const priceUsd = price ? satsToUsd(parseInt(price) || 0, btcUsd) : null;
  const upfrontUsd = upfront ? satsToUsd(parseInt(upfront) || 0, btcUsd) : null;

  const handleSubmit = () => {
    if (!price) return;
    const total = parseInt(price);
    const deposit = parseInt(upfront) || 0;
    if (deposit > total) {
      setError("Upfront cost can't be more than the total fare.");
      return;
    }
    publish(
      EVENT_KINDS.RIDE_OFFER,
      {
        priceSats: total,
        upfrontSats: deposit, // required from the rider on acceptance
        etaMinutes: parseInt(eta),
        message: "",
      },
      [
        ["e", selectedRequest.id], // which request this offer is for
        ["p", selectedRequest.pubkey], // who to notify (the rider)
        // unique per (driver, request) so offers to different requests
        // don't overwrite each other on real relays:
        ["d", "offer-" + selectedRequest.id],
        ["t", "ride-offer"],
      ]
    );
    refreshData();
    setSubmitted(true);
    setTimeout(() => setView("my-rides"), 1200);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: THEME.pageBg }}>
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4 text-4xl">🤝</div>
          <h2 className="text-white text-xl font-bold mb-2">Offer Sent</h2>
          <p className="text-white/40 text-sm">The rider will see your offer on Nostr.</p>
        </div>
      </div>
    );
  }

  return (
    <Screen title="Make an Offer" onBack={() => setView("driver-browse")}>
      <div className="space-y-5">
        <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-2">
          <Route pickup={req.pickup.name} dropoff={req.dropoff.name} />
          <div className="text-white/30 text-xs mt-1">
            {req.time === "ASAP" ? "ASAP" : new Date(req.time).toLocaleString()}
          </div>
        </div>

        <MapView pickup={req.pickup} dropoff={req.dropoff} height={220} />

        <div>
          <label className="text-xs text-white/40 uppercase tracking-wider mb-1 block">Price (sats ⚡)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && price) { e.preventDefault(); handleSubmit(); } }}
            placeholder="e.g. 5000"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-amber-500/50"
          />
          {priceUsd != null && <p className="text-white/30 text-xs mt-1">≈ {formatUsd(priceUsd)}</p>}
        </div>

        <div>
          <label className="text-xs text-white/40 uppercase tracking-wider mb-1 block">
            Upfront cost to reach you (sats ⚡)
          </label>
          <input
            type="number"
            value={upfront}
            onChange={(e) => { setUpfront(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter" && price) { e.preventDefault(); handleSubmit(); } }}
            placeholder="e.g. 1000"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-amber-500/50"
          />
          {upfrontUsd != null && <p className="text-white/30 text-xs mt-1">≈ {formatUsd(upfrontUsd)}</p>}
          <p className="text-white/30 text-xs mt-1 leading-relaxed">
            A non-refundable deposit the rider pays when they accept — it covers your drive to them
            (gas, time) if they cancel before pickup. The rest is paid for the ride itself.
          </p>
        </div>

        <div>
          <label className="text-xs text-white/40 uppercase tracking-wider mb-1 block">ETA (minutes)</label>
          <div className="flex gap-2">
            {["5", "10", "15", "20", "30"].map((m) => (
              <button
                key={m}
                onClick={() => setEta(m)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  eta === m
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-white/5 text-white/40 border border-white/10"
                }`}
              >
                {m}m
              </button>
            ))}
          </div>
        </div>

        <p className="text-white/30 text-xs">
          Your vehicle and plate (from your Account) are shown to the rider automatically.
        </p>

        {error && <p className="text-rose-400 text-xs">{error}</p>}

        <Button variant="driver" onClick={handleSubmit} disabled={!price}>
          Send Offer
        </Button>
      </div>
    </Screen>
  );
}

function Route({ pickup, dropoff }) {
  return (
    <>
      <div className="flex items-center gap-2 text-sm">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-white/70">{pickup}</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="w-2 h-2 rounded-full bg-rose-500" />
        <span className="text-white/70">{dropoff}</span>
      </div>
    </>
  );
}
