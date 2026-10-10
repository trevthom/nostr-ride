// ════════════════════════════════════════════════════════════
//  RIDER INFO — How the driver sees a rider: photo, name, and their
//  rating as a rider. Profile and history are pulled from relays on mount.
// ════════════════════════════════════════════════════════════

import { useEffect } from "react";
import { useApp } from "../../state/AppContext.jsx";
import { relay } from "../../nostr/relay.js";
import { getProfile } from "../../nostr/profiles.js";
import { shortNpub } from "../../nostr/keys.js";
import { reputation } from "../../lib/rides.js";
import Avatar from "../../ui/Avatar.jsx";
import { Rating } from "../../ui/Rating.jsx";

export function useRiderInfo(pubkey) {
  const { liveTick } = useApp();
  void liveTick; // re-read when the profile arrives
  useEffect(() => {
    if (!pubkey) return;
    relay.fetchProfile(pubkey);
    relay.fetchHistory(pubkey);
  }, [pubkey]);
  const rep = pubkey ? reputation(pubkey) : null;
  return {
    profile: pubkey ? getProfile(pubkey) : null,
    rating: rep ? rep.riderReviews : { avg: null, count: 0 },
    trips: rep ? rep.rides : 0,
  };
}

export default function RiderInfo({ pubkey, compact = false }) {
  const { openProfile } = useApp();
  const { profile, rating, trips } = useRiderInfo(pubkey);
  const name = profile?.name || shortNpub(pubkey);
  return (
    <div className="flex items-center gap-3">
      <Avatar src={profile?.picture} name={name} size={compact ? 44 : 56} onClick={() => openProfile(pubkey)} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{name}</p>
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Rating avg={rating.avg} count={rating.count} />
          <span>· {trips} trip{trips === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
  );
}
