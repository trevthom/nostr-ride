// ════════════════════════════════════════════════════════════
//  RIDES — Shared helpers for ride expiry and user reputation.
// ════════════════════════════════════════════════════════════

import { relay } from "../nostr/relay.js";
import { EVENT_KINDS } from "../nostr/eventKinds.js";

const HOUR = 3600000;
const parse = (e) => { try { return JSON.parse(e.content); } catch { return null; } };
const dtagOf = (e) => (e.tags.find((t) => t[0] === "d") || [])[1];
const etagOf = (e) => (e.tags.find((t) => t[0] === "e") || [])[1];

// When an OPEN ride request expires (ms epoch):
//  • ASAP   → 1 hour after it was created.
//  • Timed  → 1 hour after the scheduled pick-up time.
export function rideExpiryMs(content, createdAtSec) {
  if (content?.time && content.time !== "ASAP") {
    const t = Date.parse(content.time);
    if (!isNaN(t)) return t + HOUR;
  }
  return createdAtSec * 1000 + HOUR;
}

export function isRideExpired(content, createdAtSec) {
  return Date.now() > rideExpiryMs(content, createdAtSec);
}

// All event ids that belong to one ride (every version of the request,
// matched by its shared d-tag).
function versionIds(request) {
  const d = dtagOf(request);
  const ids = new Set([request.id]);
  if (d) relay.query({ kinds: [EVENT_KINDS.RIDE_REQUEST] }).forEach((e) => { if (dtagOf(e) === d) ids.add(e.id); });
  return ids;
}

// Effective ride status. Completion/cancellation are driven by explicit
// events (so the DRIVER can complete a ride they don't "own"): a
// RIDE_COMPLETE or RIDE_CANCEL e-tagging any version of the request wins
// over the request's own status field.
export function rideStatus(request) {
  const base = parse(request)?.status || "requested";
  const ids = versionIds(request);
  if (base === "cancelled") return "cancelled";
  if (relay.query({ kinds: [EVENT_KINDS.RIDE_CANCEL] }).some((c) => ids.has(etagOf(c)))) return "cancelled";
  if (base === "completed") return "completed";
  if (relay.query({ kinds: [EVENT_KINDS.RIDE_COMPLETE] }).some((c) => ids.has(etagOf(c)))) return "completed";
  return base;
}

// Who ended the ride (and when) — for messaging on the other party's screen.
export function rideEnding(request) {
  const ids = versionIds(request);
  const cancel = relay.query({ kinds: [EVENT_KINDS.RIDE_CANCEL] }).find((c) => ids.has(etagOf(c)));
  if (cancel) return { type: "cancelled", by: cancel.pubkey, at: cancel.created_at };
  const done = relay.query({ kinds: [EVENT_KINDS.RIDE_COMPLETE] }).find((c) => ids.has(etagOf(c)));
  if (done) return { type: "completed", by: done.pubkey, at: done.created_at };
  return null;
}

// Reputation for one pubkey, separated by role (rider vs driver).
// Reads the local cache (already synced from relays).
export function reputation(pubkey) {
  const allReqs = relay.query({ kinds: [EVENT_KINDS.RIDE_REQUEST] });
  const byId = {};
  const latestByDtag = {};
  allReqs.forEach((e) => {
    byId[e.id] = e;
    const d = dtagOf(e);
    if (d && (!latestByDtag[d] || e.created_at > latestByDtag[d].created_at)) latestByDtag[d] = e;
  });
  const latest = Object.values(latestByDtag);

  const rides = latest.filter((e) => e.pubkey === pubkey && rideStatus(e) === "completed").length;
  const drives = latest.filter((e) => parse(e)?.driverPubkey === pubkey && rideStatus(e) === "completed").length;

  const riderScores = [];
  const driverScores = [];
  relay.query({ kinds: [EVENT_KINDS.RATING], "#p": [pubkey] }).forEach((rt) => {
    const c = parse(rt);
    if (!c || typeof c.rating !== "number") return;
    const rideId = (rt.tags.find((t) => t[0] === "e") || [])[1];
    const orig = byId[rideId];
    if (!orig) return;
    const d = dtagOf(orig);
    const latestVer = (d && latestByDtag[d]) || orig;
    if (orig.pubkey === pubkey) riderScores.push(c.rating); // they were the rider
    else if (parse(latestVer)?.driverPubkey === pubkey) driverScores.push(c.rating); // they drove
  });

  const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
  return {
    rides,
    drives,
    riderReviews: { count: riderScores.length, avg: avg(riderScores) },
    driverReviews: { count: driverScores.length, avg: avg(driverScores) },
  };
}
