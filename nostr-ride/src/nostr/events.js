// ════════════════════════════════════════════════════════════
//  EVENTS — Builds Nostr event objects.
//
//   • createNostrEvent : unsigned placeholder event (demo / local-only
//     cache). Fine because the in-memory cache doesn't verify sigs.
//   • buildSignedEvent : REAL signed event for sending to public relays.
//
//  Every action's content is stored as a JSON string (Nostr standard).
// ════════════════════════════════════════════════════════════

import { finalizeEvent } from "nostr-tools";

// A random hex string, used for placeholder id/sig values (demo only).
function randomHex(length) {
  const arr = new Uint8Array(length / 2);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function createNostrEvent(kind, content, tags, pubkey) {
  return {
    id: randomHex(64),
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind,
    tags,
    // Content is always stored as a JSON string (the Nostr standard).
    content: typeof content === "string" ? content : JSON.stringify(content),
    sig: randomHex(128), // placeholder signature (demo/local-only events)
  };
}

// REAL, signed event — required for events sent to public relays so
// other relays/clients accept them. `sk` is the author's secret key
// (Uint8Array); finalizeEvent fills in pubkey, id, and a valid sig.
export function buildSignedEvent(kind, content, tags, sk) {
  return finalizeEvent(
    {
      kind,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: typeof content === "string" ? content : JSON.stringify(content),
    },
    sk
  );
}
