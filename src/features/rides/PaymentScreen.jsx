// ════════════════════════════════════════════════════════════
//  PAYMENT — The rider pays the driver's upfront deposit. The money
//  goes straight to the driver's Lightning address (lud16 in their
//  profile) via PayDriver. Only after payment does the ride become
//  accepted: we publish RIDE_ACCEPT and flip the request to
//  "in_progress". With no upfront deposit, the rider just continues.
//  The rest of the fare is paid at drop-off (RideProgress).
// ════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { useApp } from "../../state/AppContext.jsx";
import { relay } from "../../nostr/relay.js";
import { getProfile } from "../../nostr/profiles.js";
import { EVENT_KINDS } from "../../nostr/eventKinds.js";
import { THEME } from "../../theme.js";
import Button from "../../ui/Button.jsx";
import Screen from "../../ui/Screen.jsx";
import SatsAmount from "../../ui/SatsAmount.jsx";
import PayDriver from "./PayDriver.jsx";

export default function PaymentScreen() {
  const { publish, setView, activeRide, setActiveRide, refreshData, liveTick } = useApp();
  const [paid, setPaid] = useState(false);
  const driverPubkey = activeRide?.offer?.pubkey;

  // We need the driver's Lightning address from their profile.
  useEffect(() => { if (driverPubkey) relay.fetchProfile(driverPubkey); }, [driverPubkey]);
  void liveTick; // re-render when the profile arrives

  if (!activeRide?.offer) {
    return (
      <Screen title="Pay the Fare" onBack={() => setView("my-rides")}>
        <p className="text-white/60 text-sm pt-10 text-center">
          No offer is selected. Go to Activity, open your request, and pick an offer.
        </p>
      </Screen>
    );
  }

  const offer = JSON.parse(activeRide.offer.content);
  const driver = getProfile(driverPubkey);
  const total = offer.priceSats;
  const dueNow = offer.upfrontSats || 0; // upfront deposit required on acceptance
  const remaining = Math.max(0, total - dueNow);

  // Payment done → NOW the trip is truly accepted: publish the accept +
  // mark the request in_progress, then move to the live ride screen.
  const finishPaid = ({ verified = false } = {}) => {
    const reqContent = JSON.parse(activeRide.request.content);
    publish(
      EVENT_KINDS.RIDE_ACCEPT,
      { offerId: activeRide.offer.id, requestId: activeRide.request.id, paidSats: dueNow, verified },
      [
        ["e", activeRide.offer.id],
        ["e", activeRide.request.id],
        ["p", driverPubkey],
        ["d", "accept-" + activeRide.request.id],
        ["t", "ride-accept"],
      ]
    );
    publish(
      EVENT_KINDS.RIDE_REQUEST,
      { ...reqContent, status: "in_progress", driverPubkey },
      // p-tag the driver so their app can find this ride on the relays.
      [...activeRide.request.tags.filter((t) => t[0] !== "p"), ["p", driverPubkey]]
    );
    setPaid(true);
    setActiveRide({ ...activeRide, status: "in_progress", paidAt: Date.now() });
    refreshData();
    setTimeout(() => setView("ride-progress"), 1500);
  };

  // Back out — the trip is NOT accepted. Return to the offers list.
  const goBack = () => {
    setActiveRide(null);
    setView("rider-select");
  };

  if (paid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: THEME.pageBg }}>
        <div className="w-full max-w-sm text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4 text-4xl">✓</div>
          <h2 className="text-white text-xl font-bold mb-2">{dueNow > 0 ? "Payment Sent" : "Ride Accepted"}</h2>
          <p className="text-white/50 text-sm">Ride is now in progress.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: THEME.pageBg }}>
      <div className="w-full max-w-sm">
        <button onClick={goBack} className="text-white/60 text-sm mb-4">← Back to offers</button>
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-6 text-3xl">⚡</div>
          <h2 className="text-white text-xl font-bold mb-1 font-display">Pay the Fare</h2>
          <p className="text-white/50 text-sm mb-6">The ride isn't accepted until this is paid</p>
        </div>

        <div className="bg-white/5 rounded-2xl border border-white/10 p-6 mb-6 space-y-3">
          <Row label="Driver" value={driver?.name || "Driver"} />
          <div className="border-t border-white/10 pt-3 flex justify-between text-sm">
            <span className="text-white/50">Total fare</span>
            <SatsAmount sats={total} className="text-white" usdClassName="text-white/50" />
          </div>
          {dueNow > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Remaining at drop-off</span>
              <SatsAmount sats={remaining} className="text-white/60" usdClassName="text-white/50" />
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-white/60 font-medium">{dueNow > 0 ? "Upfront due now" : "Due now"}</span>
            <SatsAmount sats={dueNow} className="text-2xl font-bold text-amber-400" usdClassName="text-white/50 text-base" />
          </div>
          {dueNow > 0 && (
            <p className="text-white/50 text-[11px] leading-relaxed">
              This upfront deposit covers the driver's trip to you and is non-refundable if you cancel
              before pickup.
            </p>
          )}
        </div>

        {dueNow === 0 ? (
          <Button onClick={() => finishPaid()}>Continue — no upfront required</Button>
        ) : (
          <PayDriver amountSats={dueNow} address={driver?.lud16} memo="NostrRide upfront deposit" onPaid={finishPaid} />
        )}

        <p className="text-white/40 text-xs mt-4 text-center">Peer-to-peer via Lightning. No escrow.</p>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-white/50">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
