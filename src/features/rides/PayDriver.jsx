// ════════════════════════════════════════════════════════════
//  PAY DRIVER — Pays `amountSats` to the driver's Lightning address
//  (lud16 in their profile). Two ways:
//    • Connected wallet — gets an invoice from the driver's address
//      and pays it over NWC. Done when the wallet confirms.
//    • Any other wallet — shows the driver's invoice (QR / string /
//      lightning: link). If the driver's server supports LUD-21 we
//      watch for payment; otherwise the rider confirms by hand.
//  Calls onPaid({ verified }) once.
// ════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react";
import { useApp } from "../../state/AppContext.jsx";
import { payInvoice } from "../../nostr/wallet.js";
import { requestInvoice, isInvoicePaid } from "../../lib/lnurl.js";
import QRCode from "../../ui/QRCode.jsx";
import Button from "../../ui/Button.jsx";

export default function PayDriver({ amountSats, address, memo = "NostrRide fare", onPaid }) {
  const { wallet } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invoice, setInvoice] = useState(null); // { pr, verify }
  const [mode, setMode] = useState("qr"); // "qr" | "string" | "url"
  const [copied, setCopied] = useState(false);
  const [notYet, setNotYet] = useState(false);
  const doneRef = useRef(false);

  const finish = (proof) => {
    if (doneRef.current) return;
    doneRef.current = true;
    onPaid(proof);
  };

  // LUD-21: watch the invoice and finish by itself once it's paid.
  useEffect(() => {
    if (!invoice?.verify) return;
    const id = setInterval(async () => {
      try { if (await isInvoicePaid(invoice.verify)) finish({ verified: true }); } catch { /* retry next tick */ }
    }, 3000);
    return () => clearInterval(id);
  }, [invoice]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!address) {
    return (
      <p className="text-amber-400/90 text-sm text-center">
        This driver has no Lightning address, so you can't pay them in the app. Pick another offer.
      </p>
    );
  }

  const payWithWallet = async () => {
    setBusy(true);
    setError("");
    try {
      const { pr } = await requestInvoice(address, amountSats, memo);
      await payInvoice(wallet, pr);
      finish({ verified: true });
    } catch (e) {
      setError(
        (e.message || "Payment failed.") +
          " Check your wallet's history before you try again, so you don't pay twice."
      );
    }
    setBusy(false);
  };

  const showInvoice = async () => {
    setBusy(true);
    setError("");
    try {
      setInvoice(await requestInvoice(address, amountSats, memo));
    } catch (e) {
      setError(e.message || "Couldn't get an invoice from the driver's wallet.");
    }
    setBusy(false);
  };

  // "I've paid": check now if we can; otherwise trust the rider.
  const confirmPaid = async () => {
    if (!invoice.verify) { finish({ verified: false }); return; }
    setBusy(true);
    setNotYet(false);
    try {
      if (await isInvoicePaid(invoice.verify)) finish({ verified: true });
      else setNotYet(true);
    } catch (e) {
      setError(e.message || "Couldn't check the payment.");
    }
    setBusy(false);
  };

  const copy = (text) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      {/* Option 1: connected wallet */}
      <button
        onClick={payWithWallet}
        disabled={!wallet.connected || busy}
        className="w-full py-4 rounded-xl font-semibold mb-3 transition-all"
        style={{
          cursor: wallet.connected && !busy ? "pointer" : "not-allowed",
          opacity: wallet.connected ? 1 : 0.4,
          background: wallet.connected ? "#f59e0b" : "rgba(255,255,255,0.08)",
          color: wallet.connected ? "#1a1205" : "rgba(255,255,255,0.6)",
          border: "none",
        }}
      >
        {busy && !invoice ? "Paying…" : `Pay ${Number(amountSats).toLocaleString()} sats with connected wallet ⚡`}
      </button>
      {!wallet.connected && (
        <p className="text-white/50 text-xs text-center mb-4 -mt-1">Connect a wallet in Account to enable this.</p>
      )}

      {/* Option 2: the driver's invoice, for any wallet */}
      {!invoice ? (
        <button
          onClick={showInvoice}
          disabled={busy}
          className="w-full py-4 rounded-xl font-semibold border border-white/15 bg-white/5 text-white disabled:opacity-50"
        >
          Pay from another wallet
        </button>
      ) : (
        <div className="bg-white/5 rounded-2xl border border-white/10 p-4 text-center">
          <div className="flex gap-2 justify-center mb-3 flex-wrap">
            <Toggle active={mode === "qr"} onClick={() => setMode("qr")}>QR code</Toggle>
            <Toggle active={mode === "string"} onClick={() => setMode("string")}>Invoice string</Toggle>
            <Toggle active={mode === "url"} onClick={() => setMode("url")}>Lightning link</Toggle>
          </div>
          {mode === "qr" && <div className="flex justify-center mb-3"><QRCode value={invoice.pr} size={180} /></div>}
          {mode === "string" && (
            <div className="mb-3">
              <p className="text-white/60 text-xs font-mono break-all bg-black/30 rounded-lg p-3">{invoice.pr}</p>
              <button onClick={() => copy(invoice.pr)} className="text-cyan-400 text-xs mt-2">{copied ? "Copied!" : "Copy"}</button>
            </div>
          )}
          {mode === "url" && (
            <div className="mb-3">
              <a
                href={`lightning:${invoice.pr}`}
                className="inline-block bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg px-4 py-2 text-sm font-medium"
              >
                ⚡ Open in Lightning wallet
              </a>
            </div>
          )}
          <p className="text-white/50 text-[11px] mb-3">
            {invoice.verify
              ? "This invoice pays the driver directly. This screen updates by itself when the payment arrives."
              : "This invoice pays the driver directly. The driver's wallet can't confirm payments, so tap below only after your wallet shows the payment as sent."}
          </p>
          {notYet && <p className="text-amber-400/90 text-xs mb-2">Not received yet. Wait a moment and try again.</p>}
          <Button onClick={confirmPaid} disabled={busy}>{busy ? "Checking…" : "I've paid"}</Button>
        </div>
      )}

      {error && <p className="text-rose-400 text-xs text-center mt-3">{error}</p>}
    </div>
  );
}

function Toggle({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
        active ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "bg-white/5 text-white/50 border border-white/10"
      }`}
    >
      {children}
    </button>
  );
}
