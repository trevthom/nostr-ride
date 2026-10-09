// ════════════════════════════════════════════════════════════
//  LIGHTNING ADDRESS — The user's Lightning address (name@domain),
//  saved as the standard `lud16` field of their profile. Riders pay
//  drivers here, so it's required to drive. We check that the address
//  really answers before saving it.
// ════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { resolveAddress } from "../../lib/lnurl.js";

export default function LightningAddressSection({ value, onSave }) {
  const [draft, setDraft] = useState(value);
  const [status, setStatus] = useState(""); // "", "checking", "saved", or an error
  useEffect(() => setDraft(value), [value]); // pick up a restored profile

  const save = async () => {
    const addr = draft.trim().toLowerCase();
    if (!addr) { onSave(""); setStatus("saved"); return; }
    setStatus("checking");
    try {
      await resolveAddress(addr);
      onSave(addr);
      setStatus("saved");
      setTimeout(() => setStatus(""), 1500);
    } catch (e) {
      setStatus(e.message || "That Lightning address doesn't work.");
    }
  };

  const error = status && !["checking", "saved"].includes(status) ? status : "";
  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-white/50 text-xs uppercase tracking-wider">Lightning Address</p>
        {!value && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">Required to drive</span>
        )}
      </div>
      <p className="text-white/50 text-xs">Riders pay you here. Most Lightning wallets give you one (name@domain).</p>
      <div className="flex gap-2">
        <input aria-label="Lightning address"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setStatus(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }}
          placeholder="you@wallet.com"
          spellCheck={false}
          autoCapitalize="none"
          className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/50 focus:outline-none focus:border-cyan-500/50"
        />
        <button
          onClick={save}
          disabled={status === "checking" || draft.trim() === value}
          className="px-3 py-2 rounded-lg text-sm font-medium bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 disabled:opacity-40"
        >
          {status === "checking" ? "Checking…" : status === "saved" ? "Saved" : "Save"}
        </button>
      </div>
      {error && <p className="text-rose-400 text-xs">{error}</p>}
    </div>
  );
}
