// ════════════════════════════════════════════════════════════
//  RELAY EDITOR — Shows the relay list with add/remove. Adding (via
//  the button or the Enter key) calls onChange immediately with the
//  new list, so the parent can persist it right away. Each row shows
//  the relay's REAL connection state (checked every 3 s).
// ════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { relay } from "../nostr/relay.js";

const STATES = {
  connected: { dot: "bg-emerald-500", label: "Connected" },
  failed: { dot: "bg-rose-500", label: "Can't connect" },
  connecting: { dot: "bg-white/30", label: "Connecting…" },
};

export default function RelayEditor({ relays, onChange }) {
  const [newRelay, setNewRelay] = useState("");
  const [, setTick] = useState(0); // re-check states every 3 s
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(id);
  }, []);

  const add = () => {
    let url = newRelay.trim();
    if (!url) return;
    if (!/^wss?:\/\//i.test(url)) url = "wss://" + url; // be forgiving
    if (relays.includes(url)) { setNewRelay(""); return; }
    onChange([...relays, url]);
    setNewRelay("");
  };

  const remove = (i) => onChange(relays.filter((_, j) => j !== i));

  return (
    <div>
      <div className="space-y-2">
        {relays.map((r, i) => {
          const st = STATES[relay.relayState(r)];
          return (
            <div key={r + i} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/10">
              <span className={`w-2 h-2 rounded-full ${st.dot}`} title={st.label} aria-hidden="true" />
              <span className="text-white/70 text-xs font-mono flex-1 break-all">
                {r}
                <span className="sr-only"> — {st.label}</span>
              </span>
              <button onClick={() => remove(i)} aria-label={`Remove ${r}`} className="text-rose-400/80 text-xs px-1">✕</button>
            </div>
          );
        })}
        {relays.length === 0 && <p className="text-white/50 text-xs">No relays — add at least one.</p>}
      </div>
      <div className="flex gap-2 mt-2">
        <input aria-label="New relay URL"
          value={newRelay}
          onChange={(e) => setNewRelay(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="wss://relay.example.com"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono placeholder-white/50 focus:outline-none focus:border-cyan-500/50"
        />
        <button
          onClick={add}
          className="px-3 py-2 rounded-lg text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
        >
          Add
        </button>
      </div>
    </div>
  );
}
