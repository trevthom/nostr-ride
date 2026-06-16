// ════════════════════════════════════════════════════════════
//  ADDRESS INPUT — Type a real address and pick from live results
//  (OpenStreetMap / Nominatim geocoding). Calls
//  onSelect({ name, lat, lng }) when a suggestion is chosen.
//  Searches are debounced (waits for a pause in typing).
// ════════════════════════════════════════════════════════════

import { useState, useRef } from "react";
import { searchAddress } from "../lib/geocode.js";

export default function AddressInput({ label, value, onSelect, dotColor = "bg-emerald-500", placeholder }) {
  const [text, setText] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef(null);
  const reqId = useRef(0);

  const handleChange = (q) => {
    setText(q);
    onSelect(null); // typing invalidates any previous selection
    setOpen(true);
    setError("");
    clearTimeout(timer.current);

    if (q.trim().length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const myReq = ++reqId.current;
    // Wait 400ms after the last keystroke before searching (be kind to the API).
    timer.current = setTimeout(async () => {
      try {
        const found = await searchAddress(q);
        if (myReq === reqId.current) setResults(found);
      } catch {
        if (myReq === reqId.current) {
          setResults([]);
          setError("Search failed — try again.");
        }
      } finally {
        if (myReq === reqId.current) setLoading(false);
      }
    }, 400);
  };

  const choose = (loc) => {
    onSelect(loc);
    setText(loc.name);
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="relative">
      {label && <label className="text-xs text-white/40 uppercase tracking-wider mb-1 block">{label}</label>}
      <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10 focus-within:border-cyan-500/50 transition-colors">
        <div className={`w-3 h-3 rounded-full ${dotColor} shrink-0`} />
        <input
          value={text || (value?.name ?? "")}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results.length > 0) {
              e.preventDefault();
              choose(results[0]);
            }
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)} // let a click land first
          placeholder={placeholder}
          className="bg-transparent text-white text-sm flex-1 placeholder-white/20 focus:outline-none"
        />
        {loading && <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin shrink-0" />}
      </div>

      {open && (text.trim().length >= 3) && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-[#0c1622] border border-white/10 rounded-xl overflow-hidden shadow-xl max-h-64 overflow-y-auto">
          {error && <p className="text-rose-400 text-xs px-4 py-3">{error}</p>}
          {!error && !loading && results.length === 0 && (
            <p className="text-white/30 text-xs px-4 py-3">No matches.</p>
          )}
          {results.map((loc, i) => (
            <button
              key={i}
              onMouseDown={() => choose(loc)} // fires before input blur
              className="w-full text-left px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 transition-colors"
            >
              {loc.name}
              <span className="block text-white/30 text-[10px] truncate">{loc.fullName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
