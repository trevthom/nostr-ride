// ════════════════════════════════════════════════════════════
//  WALLET SECTION — Connect a Nostr Wallet Connect string, then
//  show the REAL balance + transactions fetched from your wallet,
//  and send / receive sats. Nothing is faked: if the wallet can't
//  be reached you see an error, not invented numbers.
// ════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import { useApp } from "../../state/AppContext.jsx";
import {
  parseNwcUri,
  emptyWalletState,
  getBalance,
  listTransactions,
  payInvoice,
  makeInvoice,
} from "../../nostr/wallet.js";
import { THEME } from "../../theme.js";
import QRCode from "../../ui/QRCode.jsx";

export default function WalletSection() {
  const { wallet, setWallet, btcUsd } = useApp();
  const [uri, setUri] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const [balance, setBalance] = useState(null); // null = not loaded yet
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [panel, setPanel] = useState(null); // null | "send" | "receive"

  // Fetch real balance + transactions from the connected wallet.
  const refresh = useCallback(async () => {
    if (!wallet.connected) return;
    setLoading(true);
    setLoadError("");
    try {
      const [bal, history] = await Promise.all([getBalance(wallet), listTransactions(wallet)]);
      setBalance(bal);
      setTxns(history);
    } catch (e) {
      setLoadError(e.message || "Couldn't reach the wallet.");
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleConnect = async () => {
    setError("");
    const parsed = parseNwcUri(uri);
    if (!parsed) {
      setError("That doesn't look like a valid NWC string (nostr+walletconnect://...).");
      return;
    }
    setConnecting(true);
    try {
      await getBalance(parsed); // probe: only connect if the wallet actually answers
      setWallet(parsed);
      setUri("");
    } catch (e) {
      setError(e.message || "Couldn't reach the wallet with that string.");
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    setWallet(emptyWalletState());
    setBalance(null);
    setTxns([]);
    setPanel(null);
  };

  // ── Not connected: connect form ──
  if (!wallet.connected) {
    return (
      <div>
        <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Lightning Wallet</p>
        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
          <p className="text-white/50 text-xs mb-3">
            Paste your Nostr Wallet Connect string to pay and get paid in sats. We read your real
            balance directly from your wallet.
          </p>
          <input
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && uri && !connecting) { e.preventDefault(); handleConnect(); } }}
            placeholder="nostr+walletconnect://..."
            spellCheck={false}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono placeholder-white/20 focus:outline-none focus:border-cyan-500/50 mb-2"
          />
          {error && <p className="text-rose-400 text-xs mb-2">{error}</p>}
          <button
            onClick={handleConnect}
            disabled={!uri || connecting}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-30"
            style={{ background: THEME.brandGradient }}
          >
            {connecting ? "Connecting…" : "Connect Wallet"}
          </button>
        </div>
      </div>
    );
  }

  // ── Connected: real balance, actions, history ──
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-white/40 text-xs uppercase tracking-wider">Lightning Wallet</p>
        <div className="flex gap-3">
          <button onClick={refresh} className="text-cyan-400 text-xs">Refresh</button>
          <button onClick={disconnect} className="text-rose-400/60 text-xs">Disconnect</button>
        </div>
      </div>

      <div
        className="rounded-2xl border border-amber-500/20 p-5 mb-3"
        style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.10), rgba(249,115,22,0.05))" }}
      >
        <p className="text-white/40 text-xs">Balance</p>
        {loading && balance === null ? (
          <p className="text-white/40 text-lg">Loading…</p>
        ) : loadError ? (
          <p className="text-rose-400 text-sm">{loadError}</p>
        ) : (
          <p className="text-white text-3xl font-bold">
            {(balance ?? 0).toLocaleString()} <span className="text-amber-400 text-base">sats</span>
          </p>
        )}
        {balance != null && btcUsd && (
          <p className="text-white/40 text-sm mt-0.5">≈ ${(balance * 1e-8 * btcUsd).toFixed(2)}</p>
        )}
        <div className="flex gap-2 mt-4">
          <ActionBtn onClick={() => setPanel(panel === "send" ? null : "send")} active={panel === "send"}>↑ Send</ActionBtn>
          <ActionBtn onClick={() => setPanel(panel === "receive" ? null : "receive")} active={panel === "receive"}>↓ Receive</ActionBtn>
        </div>
      </div>

      {panel === "send" && <SendPanel wallet={wallet} onSent={() => { setPanel(null); refresh(); }} />}
      {panel === "receive" && <ReceivePanel wallet={wallet} onSettled={refresh} />}

      <p className="text-white/30 text-xs uppercase tracking-widest mt-4 mb-2">Transactions</p>
      <div className="space-y-2">
        {loading && <p className="text-white/30 text-xs">Loading…</p>}
        {!loading && txns.length === 0 && (
          <p className="text-white/30 text-xs">No transactions yet.</p>
        )}
        {txns.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between bg-white/[0.02] border border-white/10 rounded-lg px-3 py-2">
            <div>
              <p className="text-white/80 text-sm">{tx.memo}</p>
              <p className="text-white/30 text-[10px]">{tx.ts ? new Date(tx.ts).toLocaleString() : ""}</p>
            </div>
            <span className={`text-sm font-medium ${tx.type === "received" ? "text-emerald-400" : "text-rose-400"}`}>
              {tx.type === "received" ? "+" : "−"}{tx.amountSats.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionBtn({ children, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${
        active ? "bg-white/15 text-white border-white/20" : "bg-white/5 text-white/70 border-white/10"
      }`}
    >
      {children}
    </button>
  );
}

// ── Send: pay a real BOLT11 invoice ──
function SendPanel({ wallet, onSent }) {
  const [invoice, setInvoice] = useState("");
  const [status, setStatus] = useState(""); // "", "sending", error text
  const [done, setDone] = useState(false);

  const send = async () => {
    setStatus("sending");
    try {
      await payInvoice(wallet, invoice.trim());
      setDone(true);
      setTimeout(onSent, 1200);
    } catch (e) {
      setStatus(e.message || "Payment failed.");
    }
  };

  if (done) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-1 text-center">
        <p className="text-emerald-400 text-sm font-medium">✓ Payment sent</p>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-1 space-y-2">
      <input
        value={invoice}
        onChange={(e) => setInvoice(e.target.value)}
        placeholder="Paste a Lightning invoice (lnbc...)"
        spellCheck={false}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono placeholder-white/20 focus:outline-none focus:border-cyan-500/50"
      />
      {status && status !== "sending" && <p className="text-rose-400 text-xs">{status}</p>}
      <button
        onClick={send}
        disabled={!invoice || status === "sending"}
        className="w-full py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-30"
        style={{ background: THEME.driverGradient }}
      >
        {status === "sending" ? "Paying…" : "Pay Invoice"}
      </button>
      <p className="text-white/20 text-[10px]">Tip: in a live build, the camera scans a QR to fill this in.</p>
    </div>
  );
}

// ── Receive: ask the wallet for a real invoice; show string + QR ──
function ReceivePanel({ wallet, onSettled }) {
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [invoice, setInvoice] = useState("");
  const [status, setStatus] = useState(""); // "", "creating", error text

  const create = async () => {
    setStatus("creating");
    try {
      const inv = await makeInvoice(wallet, parseInt(amount || "0"), memo);
      setInvoice(inv);
      setStatus("");
      onSettled?.();
    } catch (e) {
      setStatus(e.message || "Couldn't create an invoice.");
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-1 space-y-2">
      {!invoice ? (
        <>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (sats)"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-cyan-500/50"
          />
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Memo (optional)"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-cyan-500/50"
          />
          {status && status !== "creating" && <p className="text-rose-400 text-xs">{status}</p>}
          <button
            onClick={create}
            disabled={!amount || status === "creating"}
            className="w-full py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-30"
            style={{ background: THEME.brandGradient }}
          >
            {status === "creating" ? "Creating…" : "Generate Invoice"}
          </button>
        </>
      ) : (
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <QRCode value={invoice} size={170} />
          </div>
          <p className="text-white/60 text-[10px] font-mono break-all bg-white/5 rounded-lg p-2">{invoice}</p>
          <button onClick={() => navigator.clipboard?.writeText(invoice)} className="text-cyan-400 text-xs mt-2">
            Copy invoice
          </button>
        </div>
      )}
    </div>
  );
}
