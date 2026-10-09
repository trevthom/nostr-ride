// ════════════════════════════════════════════════════════════
//  DRIVER OFFER — A driver sets price/ETA/vehicle and publishes a
//  Kind 30079 offer that references the chosen ride request.
// ════════════════════════════════════════════════════════════

import { useState } from "react";
import { useApp } from "../../state/AppContext.jsx";
import { EVENT_KINDS } from "../../nostr/eventKinds.js";
import Screen from "../../ui/Screen.jsx";
import Button from "../../ui/Button.jsx";
import MapView from "../../ui/MapView.jsx";
import { satsToUsd, formatUsd } from "../../ui/SatsAmount.jsx";
import { seal } from "../../lib/privacy.js";
import SentConfirmation from "../../ui/SentConfirmation.jsx";

export default function DriverOfferScreen() {
  const { user, publish, setView, selectedRequest, refreshData, btcUsd } = useApp();
  const [price, setPrice] = useState("");
  const [upfront, setUpfront] = useState("");
  const [eta, setEta] = useState("10");
  const [submitted, setSubmitted] = useState(false);
  const [accepted, setAccepted] = useState(null); // did a relay take it?
  const [error, setError] = useState("");

  if (!selectedRequest) return null;
  const isDemo = selectedRequest.tags.some((t) => t[0] === "demo");
  const req = JSON.parse(selectedRequest.content);
  const priceUsd = price ? satsToUsd(parseInt(price) || 0, btcUsd) : null;
  const upfrontUsd = upfront ? satsToUsd(parseInt(upfront) || 0, btcUsd) : null;

  const handleSubmit = () => {
    if (!price) return;
    const total = parseInt(price);
    const deposit = parseInt(upfront) || 0;
    if (!(total > 0)) {
      setError("The price must be more than 0 sats.");
      return;
    }
    if (deposit < 0) {
      setError("Upfront cost can't be negative.");
      return;
    }
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
        // The plate is private: only this rider can read it.
        plate: seal(user.sk, selectedRequest.pubkey, {
          plateState: user.vehicle?.plateState || "",
          plateNumber: user.vehicle?.plateNumber || "",
        }),
      },
      [
        ["e", selectedRequest.id], // which request this offer is for
        ["p", selectedRequest.pubkey], // who to notify (the rider)
        // unique per (driver, request) so offers to different requests
        // don't overwrite each other on real relays:
        ["d", "offer-" + selectedRequest.id],
        ["t", "ride-offer"],
      ],
      // Demo requests are local-only, so the offer must be too.
      { localOnly: isDemo }
    ).then(setAccepted);
    refreshData();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <SentConfirmation
        icon="🤝"
        title="Offer Sent"
        message="The rider will see your offer on Nostr."
        accepted={accepted}
        localOnly={isDemo}
        onDone={() => setView("my-rides")}
      />
    );
  }

  return (
    <Screen title="Make an Offer" onBack={() => setView("driver-browse")}>
      <div className="space-y-5">
        <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-2">
          <Route pickup={req.pickup.name} dropoff={req.dropoff.name} />
          <div className="text-white/50 text-xs mt-1">
            {req.time === "ASAP" ? "ASAP" : new Date(req.time).toLocaleString()}
          </div>
        </div>

        <MapView pickup={req.pickup} dropoff={req.dropoff} height={220} />

        <div>
          <label className="text-xs text-white/60 uppercase tracking-wider mb-1 block">Price (sats ⚡)</label>
          <input aria-label="Price in sats"
            type="number"
            value={price}
            onChange={(e) => { setPrice(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter" && price) { e.preventDefault(); handleSubmit(); } }}
            placeholder="e.g. 5000"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:border-amber-500/50"
          />
          {priceUsd != null && <p className="text-white/50 text-xs mt-1">≈ {formatUsd(priceUsd)}</p>}
        </div>

        <div>
          <label className="text-xs text-white/60 uppercase tracking-wider mb-1 block">
            Upfront cost to reach you (sats ⚡)
          </label>
          <input aria-label="Upfront cost in sats"
            type="number"
            value={upfront}
            onChange={(e) => { setUpfront(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter" && price) { e.preventDefault(); handleSubmit(); } }}
            placeholder="e.g. 1000"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:border-amber-500/50"
          />
          {upfrontUsd != null && <p className="text-white/50 text-xs mt-1">≈ {formatUsd(upfrontUsd)}</p>}
          <p className="text-white/50 text-xs mt-1 leading-relaxed">
            A non-refundable deposit the rider pays when they accept — it covers your drive to them
            (gas, time) if they cancel before pickup. The rest is paid for the ride itself.
          </p>
        </div>

        <div>
          <label className="text-xs text-white/60 uppercase tracking-wider mb-1 block">ETA (minutes)</label>
          <div className="flex gap-2">
            {["5", "10", "15", "20", "30"].map((m) => (
              <button
                key={m}
                onClick={() => setEta(m)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  eta === m
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-white/5 text-white/60 border border-white/10"
                }`}
              >
                {m}m
              </button>
            ))}
          </div>
        </div>

        <p className="text-white/50 text-xs">
          Your vehicle (from your Account) is shown to the rider. Your plate is sent privately to this rider only.
          The pickup above is approximate; you get the exact address when the rider accepts.
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
