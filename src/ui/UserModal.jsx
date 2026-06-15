// ════════════════════════════════════════════════════════════
//  USER MODAL — Tapping any username opens this. Shows their face
//  photo (larger), display name, full npub, and their ride/drive
//  reputation. Fetches the profile from relays on open.
// ════════════════════════════════════════════════════════════

import { useEffect } from "react";
import { useApp } from "../state/AppContext.jsx";
import { relay } from "../nostr/relay.js";
import { getProfile } from "../nostr/profiles.js";
import { fullNpub } from "../nostr/keys.js";
import { reputation } from "../lib/rides.js";

export default function UserModal() {
  const { profileModalPubkey, closeProfile } = useApp();

  useEffect(() => {
    if (profileModalPubkey) relay.fetchProfile(profileModalPubkey);
  }, [profileModalPubkey]);

  if (!profileModalPubkey) return null;

  const p = getProfile(profileModalPubkey);
  const rep = reputation(profileModalPubkey);
  const name = p?.name || "Anonymous";
  const initial = name.charAt(0).toUpperCase();
  const hasRider = rep.rides > 0 || rep.riderReviews.count > 0;
  const hasDriver = rep.drives > 0 || rep.driverReviews.count > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={closeProfile}
    >
      <div
        className="w-full max-w-xs rounded-2xl border border-white/10 p-6 text-center"
        style={{ background: "#0b1220" }}
        onClick={(e) => e.stopPropagation()}
      >
        {p?.picture ? (
          <img
            src={p.picture}
            alt={name}
            className="w-28 h-28 rounded-full object-cover mx-auto mb-4 border border-white/10"
          />
        ) : (
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-cyan-500/30 to-emerald-500/30 flex items-center justify-center mx-auto mb-4 text-4xl text-white font-bold">
            {initial}
          </div>
        )}

        <h3 className="text-white font-bold text-lg">{name}</h3>

        {(hasRider || hasDriver) && (
          <div className="flex justify-center gap-6 mt-3 text-sm">
            {hasRider && (
              <div>
                <p className="text-white/40 text-[11px] uppercase tracking-wider">Rider</p>
                <p className="text-white/80">{rep.rides} Rides · {rep.riderReviews.count} Reviews</p>
                {rep.riderReviews.avg != null && (
                  <p className="text-amber-400 text-xs">★ {rep.riderReviews.avg.toFixed(1)}</p>
                )}
              </div>
            )}
            {hasDriver && (
              <div>
                <p className="text-white/40 text-[11px] uppercase tracking-wider">Driver</p>
                <p className="text-white/80">{rep.drives} Drives · {rep.driverReviews.count} Reviews</p>
                {rep.driverReviews.avg != null && (
                  <p className="text-amber-400 text-xs">★ {rep.driverReviews.avg.toFixed(1)}</p>
                )}
              </div>
            )}
          </div>
        )}

        <p className="text-white/40 text-[11px] font-mono break-all mt-4">{fullNpub(profileModalPubkey)}</p>

        <button
          onClick={closeProfile}
          className="mt-5 w-full py-2.5 rounded-lg text-sm font-medium bg-white/10 text-white"
        >
          Close
        </button>
      </div>
    </div>
  );
}
