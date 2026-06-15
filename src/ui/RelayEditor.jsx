// ════════════════════════════════════════════════════════════
//  RELAY EDITOR — Shows the relay list with add/remove. Adding (via
//  the button or the Enter key) calls onChange immediately with the
//  new list, so the parent can persist it right away.
// ════════════════════════════════════════════════════════════

import { useState } from "react";

export default function RelayEditor({ relays, onChange }) {
  const [newRelay, setNewRelay] = useState("");

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
        {relays.map((r, i) => (
          <div key={r + i} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/10">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-white/60 text-xs font-mono flex-1 break-all">{r}</span>
            <button onClick={() => remove(i)} className="text-rose-400/60 text-xs px-1">✕</button>
          </div>
        ))}
        {relays.length === 0 && <p className="text-white/30 text-xs">No relays — add at least one.</p>}
      </div>
      <div className="flex gap-2 mt-2">
        <input
          value={newRelay}
          onChange={(e) => setNewRelay(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="wss://relay.example.com"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono placeholder-white/20 focus:outline-none focus:border-cyan-500/50"
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
