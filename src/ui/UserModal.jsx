// ════════════════════════════════════════════════════════════
//  USER MODAL — Tapping any username/npub opens this. Shows the face
//  photo (tap to expand), display name, full npub, role-split
//  reputation (always shown, even at 0), and vehicle photo + details.
//  Rendered above everything; close via the ✕ or by tapping outside.
// ════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { useApp } from "../state/AppContext.jsx";
import { relay } from "../nostr/relay.js";
import { getProfile } from "../nostr/profiles.js";
import { fullNpub } from "../nostr/keys.js";
import { reputation } from "../lib/rides.js";

export default function UserModal() {
  const { profileModalPubkey, closeProfile } = useApp();
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    if (profileModalPubkey) relay.fetchProfile(profileModalPubkey);
    setZoom(false);
  }, [profileModalPubkey]);

  if (!profileModalPubkey) return null;

  const p = getProfile(profileModalPubkey);
  const rep = reputation(profileModalPubkey);
  const name = p?.name || "Anonymous";
  const initial = name.charAt(0).toUpperCase();
  const veh = p?.vehicle || null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.7)", zIndex: 10040 }}
      onClick={closeProfile}
    >
      <div
        className="w-full max-w-xs rounded-2xl border border-white/10 p-6 text-center relative"
        style={{ background: "#0b1220", maxHeight: "88vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={closeProfile}
          aria-label="Close"
          className="absolute top-2 right-3 text-white/50 text-xl leading-none"
        >
          ×
        </button>

        {p?.picture ? (
          <img
            src={p.picture}
            alt={name}
            onClick={() => setZoom(true)}
            className="w-28 h-28 rounded-full object-cover mx-auto mb-4 border border-white/10 cursor-zoom-in"
          />
        ) : (
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-cyan-500/30 to-emerald-500/30 flex items-center justify-center mx-auto mb-4 text-4xl text-white font-bold">
            {initial}
          </div>
        )}

        <h3 className="text-white font-bold text-lg">{name}</h3>

        {/* Always show both roles, even at zero. */}
        <div className="flex justify-center gap-6 mt-3 text-sm">
          <div>
            <p className="text-white/40 text-[11px] uppercase tracking-wider">Rider</p>
            <p className="text-white/80">{rep.rides} Rides · {rep.riderReviews.count} Reviews</p>
            {rep.riderReviews.avg != null && <p className="text-amber-400 text-xs">★ {rep.riderReviews.avg.toFixed(1)}</p>}
          </div>
          <div>
            <p className="text-white/40 text-[11px] uppercase tracking-wider">Driver</p>
            <p className="text-white/80">{rep.drives} Drives · {rep.driverReviews.count} Reviews</p>
            {rep.driverReviews.avg != null && <p className="text-amber-400 text-xs">★ {rep.driverReviews.avg.toFixed(1)}</p>}
          </div>
        </div>

        <p className="text-white/40 text-[11px] font-mono break-all mt-4">{fullNpub(profileModalPubkey)}</p>

        {veh && (veh.make || veh.model || veh.plateNumber || veh.picture) && (
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="text-white/40 text-[11px] uppercase tracking-wider mb-2">Vehicle</p>
            {veh.picture && (
              <img src={veh.picture} alt="Vehicle" onClick={() => setZoom("veh")} className="w-full h-28 object-cover rounded-lg border border-white/10 mb-2 cursor-zoom-in" />
            )}
            {(veh.year || veh.make || veh.model) && (
              <p className="text-white/80 text-sm">{[veh.year, veh.make, veh.model].filter(Boolean).join(" ")}</p>
            )}
            {veh.plateState && veh.plateNumber && (
              <p className="text-white/40 text-xs mt-0.5">Plate: {veh.plateState} · {veh.plateNumber}</p>
            )}
          </div>
        )}
      </div>

      {/* Expanded photo view */}
      {zoom && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.92)", zIndex: 10060 }}
          onClick={(e) => { e.stopPropagation(); setZoom(false); }}
        >
          <img
            src={zoom === "veh" ? veh?.picture : p?.picture}
            alt={name}
            className="max-w-[92vw] max-h-[85vh] object-contain rounded-lg"
          />
        </div>
      )}
    </div>
  );
}
