// ════════════════════════════════════════════════════════════
//  PAYMENT — Where the rider settles the fare. Two options:
//    • Pay with connected wallet — pays via the rider's NWC wallet.
//      Greyed out if no wallet is connected.
//    • Generate invoice — shows a Lightning invoice (QR or copyable
//      string) the rider can pay from any external wallet.
//
//  This is a peer-to-peer demo: real invoice exchange between rider and
//  driver would carry the driver's BOLT11; here "Pay with connected
//  wallet" confirms the fare and a generated invoice demonstrates the
//  QR/string flow.
// ════════════════════════════════════════════════════════════

import { useState } from "react";
import { useApp } from "../../state/AppContext.jsx";
import { getProfile } from "../../nostr/profiles.js";
import { EVENT_KINDS } from "../../nostr/eventKinds.js";
import { makeInvoice } from "../../nostr/wallet.js";
import { THEME } from "../../theme.js";
import Button from "../../ui/Button.jsx";
import QRCode from "../../ui/QRCode.jsx";
import SatsAmount from "../../ui/SatsAmount.jsx";

export default function PaymentScreen() {
  const { publish, setView, activeRide, setActiveRide, refreshData, wallet } = useApp();
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [invoice, setInvoice] = useState("");
  const [invoiceMode, setInvoiceMode] = useState("qr"); // "qr" | "string" | "url"
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  if (!activeRide?.offer) return null;
  const offer = JSON.parse(activeRide.offer.content);
  const driver = getProfile(activeRide.offer.pubkey);
  const total = offer.priceSats;
  const dueNow = offer.upfrontSats || 0; // upfront deposit required on acceptance
  const remaining = Math.max(0, total - dueNow);
  const amount = dueNow;

  // Payment done → NOW the trip is truly accepted: publish the accept +
  // mark the request in_progress, then move to the live ride screen.
  const finishPaid = () => {
    const reqContent = JSON.parse(activeRide.request.content);
    publish(
      EVENT_KINDS.RIDE_ACCEPT,
      { offerId: activeRide.offer.id, requestId: activeRide.request.id },
      [
        ["e", activeRide.offer.id],
        ["e", activeRide.request.id],
        ["p", activeRide.offer.pubkey],
        ["d", "accept-" + activeRide.request.id],
        ["t", "ride-accept"],
      ]
    );
    publish(
      EVENT_KINDS.RIDE_REQUEST,
      { ...reqContent, status: "in_progress", driverPubkey: activeRide.offer.pubkey },
      activeRide.request.tags
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

  const handlePayWallet = () => {
    if (!wallet.connected) return;
    setPaying(true);
    setError("");
    // Demo: confirm the fare. A full build would pay the driver's BOLT11.
    setTimeout(() => { setPaying(false); finishPaid(); }, 1500);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError("");
    try {
      if (wallet.connected) {
        const inv = await makeInvoice(wallet, amount, "NostrRide fare");
        if (inv) setInvoice(inv);
        else setError("Wallet didn't return an invoice.");
      } else {
        // No wallet connected: show a clearly-labeled demo invoice string.
        setInvoice(`lnbc${amount}n1demo-invoice-${Date.now().toString(36)}`);
      }
    } catch (e) {
      setError(e.message || "Couldn't generate an invoice.");
    }
    setGenerating(false);
  };

  const copy = (text) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (paid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: THEME.pageBg }}>
        <div className="w-full max-w-sm text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4 text-4xl">✓</div>
          <h2 className="text-white text-xl font-bold mb-2">Payment Confirmed</h2>
          <p className="text-white/40 text-sm">Ride is now in progress.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: THEME.pageBg }}>
      <div className="w-full max-w-sm">
        <button onClick={goBack} className="text-white/50 text-sm mb-4">← Back to offers</button>
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-6 text-3xl">⚡</div>
          <h2 className="text-white text-xl font-bold mb-1 font-display">Pay the Fare</h2>
          <p className="text-white/40 text-sm mb-6">The ride isn't accepted until this is paid</p>
        </div>

        <div className="bg-white/5 rounded-2xl border border-white/10 p-6 mb-6 space-y-3">
          <Row label="Driver" value={driver?.name || "Driver"} />
          <div className="border-t border-white/10 pt-3 flex justify-between text-sm">
            <span className="text-white/40">Total fare</span>
            <SatsAmount sats={total} className="text-white" usdClassName="text-white/30" />
          </div>
          {dueNow > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Remaining at drop-off</span>
              <SatsAmount sats={remaining} className="text-white/60" usdClassName="text-white/30" />
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-white/60 font-medium">{dueNow > 0 ? "Upfront due now" : "Due now"}</span>
            <SatsAmount sats={amount} className="text-2xl font-bold text-amber-400" usdClassName="text-white/40 text-base" />
          </div>
          {dueNow > 0 && (
            <p className="text-white/30 text-[11px] leading-relaxed">
              This upfront deposit covers the driver's trip to you and is non-refundable if you cancel
              before pickup.
            </p>
          )}
        </div>

        {amount === 0 ? (
          <Button onClick={finishPaid}>Continue — no upfront required</Button>
        ) : (
          <>
            {/* Option 1: connected wallet */}
            <button
              onClick={handlePayWallet}
              disabled={!wallet.connected || paying}
              className="w-full py-4 rounded-xl font-semibold mb-3 transition-all"
              style={{
                cursor: wallet.connected ? "pointer" : "not-allowed",
                opacity: wallet.connected ? 1 : 0.4,
                background: wallet.connected ? "#f59e0b" : "rgba(255,255,255,0.08)",
                color: wallet.connected ? "#1a1205" : "rgba(255,255,255,0.5)",
                border: "none",
              }}
            >
              {paying ? "Processing…" : "Pay with connected wallet ⚡"}
            </button>
            {!wallet.connected && (
              <p className="text-white/30 text-xs text-center mb-4 -mt-1">
                Connect a wallet in Account to enable this.
              </p>
            )}

            {/* Option 2: generate invoice */}
            {!invoice ? (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full py-4 rounded-xl font-semibold border border-white/15 bg-white/5 text-white"
              >
                {generating ? "Generating…" : "Generate invoice"}
              </button>
            ) : (
              <div className="bg-white/5 rounded-2xl border border-white/10 p-4 text-center">
                <div className="flex gap-2 justify-center mb-3 flex-wrap">
                  <Toggle active={invoiceMode === "qr"} onClick={() => setInvoiceMode("qr")}>QR code</Toggle>
                  <Toggle active={invoiceMode === "string"} onClick={() => setInvoiceMode("string")}>Invoice string</Toggle>
                  <Toggle active={invoiceMode === "url"} onClick={() => setInvoiceMode("url")}>Lightning link</Toggle>
                </div>
                {invoiceMode === "qr" && (
                  <div className="flex justify-center mb-3"><QRCode value={invoice} size={180} /></div>
                )}
                {invoiceMode === "string" && (
                  <div className="mb-3">
                    <p className="text-white/60 text-xs font-mono break-all bg-black/30 rounded-lg p-3">{invoice}</p>
                    <button onClick={() => copy(invoice)} className="text-cyan-400 text-xs mt-2">{copied ? "Copied!" : "Copy"}</button>
                  </div>
                )}
                {invoiceMode === "url" && (
                  <div className="mb-3">
                    <a
                      href={`lightning:${invoice}`}
                      className="inline-block bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg px-4 py-2 text-sm font-medium break-all"
                    >
                      ⚡ Open in Lightning wallet
                    </a>
                    <p className="text-white/40 text-[11px] font-mono break-all mt-2">lightning:{invoice}</p>
                    <button onClick={() => copy(`lightning:${invoice}`)} className="text-cyan-400 text-xs mt-1">
                      {copied ? "Copied!" : "Copy link"}
                    </button>
                  </div>
                )}
                <p className="text-white/30 text-[11px] mb-3">Pay this with any Lightning wallet, then tap below.</p>
                <Button onClick={finishPaid}>I've paid</Button>
              </div>
            )}
          </>
        )}

        {error && <p className="text-rose-400 text-xs text-center mt-3">{error}</p>}
        <p className="text-white/20 text-xs mt-4 text-center">Peer-to-peer via Lightning. No escrow.</p>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-white/40">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}

function Toggle({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
        active ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "bg-white/5 text-white/40 border border-white/10"
      }`}
    >
      {children}
    </button>
  );
}
