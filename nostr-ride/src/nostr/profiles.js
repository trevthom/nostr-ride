// ════════════════════════════════════════════════════════════
//  PROFILES — Look up a user's name + contact info by public key.
//  Reads the most recent Kind 0 (metadata) event for that user.
// ════════════════════════════════════════════════════════════

import { relay } from "./relay.js";
import { EVENT_KINDS } from "./eventKinds.js";

export function getProfile(pubkey) {
  const events = relay.query({ kinds: [EVENT_KINDS.METADATA], authors: [pubkey] });
  if (events.length === 0) return null;
  try {
    const meta = JSON.parse(events[events.length - 1].content);
    return {
      name: meta.name,
      comm: meta.communication || [],
      picture: meta.picture || "",
      vehicle: meta.vehicle || null,
    };
  } catch {
    return null;
  }
}
