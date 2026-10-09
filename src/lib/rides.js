// ════════════════════════════════════════════════════════════
//  RIDES — Shared helpers for ride expiry and user reputation.
//
//  Trust rules (relay events are signed, but ANYONE can sign one):
//   • A ride's versions are the requests with the same AUTHOR and
//     d-tag (the NIP-01 address kind:pubkey:d) — never d-tag alone.
//   • A cancel counts only from the rider or the assigned driver.
//   • A completion counts only from the assigned driver.
//   • A rating counts only from the other party of that ride.
// ════════════════════════════════════════════════════════════

import { relay } from "../nostr/relay.js";
import { EVENT_KINDS } from "../nostr/eventKinds.js";

const HOUR = 3600000;
const parse = (e) => { try { return JSON.parse(e.content); } catch { return null; } };
const dtagOf = (e) => (e.tags.find((t) => t[0] === "d") || [])[1];
const etagOf = (e) => (e.tags.find((t) => t[0] === "e") || [])[1];

// Screens call these helpers for every row on every render, so results
// are cached until the event cache changes (relay.version).
const memo = new Map();
let memoVersion = -1;
function cached(key, fn) {
  if (relay.version !== memoVersion) { memo.clear(); memoVersion = relay.version; }
  if (!memo.has(key)) memo.set(key, fn());
  return memo.get(key);
}

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

// Every version of one ride (same author + d-tag), newest first.
export function rideVersions(request) {
  return cached("v:" + request.id, () => findVersions(request)).slice();
}
function findVersions(request) {
  const d = dtagOf(request);
  const found = d ? relay.query({ kinds: [EVENT_KINDS.RIDE_REQUEST], authors: [request.pubkey], "#d": [d] }) : [];
  if (!found.some((e) => e.id === request.id)) found.push(request);
  // Reverse first so a same-second tie goes to the most recently stored
  // version (the sort is stable), matching latestVersions().
  return found.reverse().sort((a, b) => b.created_at - a.created_at);
}

// The ride's version ids, rider, and assigned driver. Only the rider can
// author a version, so the driverPubkey they named is trustworthy.
function rideParties(request) {
  const versions = rideVersions(request);
  const driver = versions.map((e) => parse(e)?.driverPubkey).find(Boolean) || null;
  return { ids: new Set(versions.map((e) => e.id)), rider: request.pubkey, driver };
}

// The valid cancel / complete event for a ride (or undefined).
function findCancel({ ids, rider, driver }) {
  return relay.query({ kinds: [EVENT_KINDS.RIDE_CANCEL], "#e": [...ids] })
    .find((c) => ids.has(etagOf(c)) && (c.pubkey === rider || (driver && c.pubkey === driver)));
}
function findComplete({ ids, driver }) {
  if (!driver) return undefined;
  return relay.query({ kinds: [EVENT_KINDS.RIDE_COMPLETE], "#e": [...ids], authors: [driver] })
    .find((c) => ids.has(etagOf(c)));
}

// Effective ride status. Completion/cancellation are driven by explicit
// events (so the DRIVER can complete a ride they don't "own"): a valid
// RIDE_COMPLETE or RIDE_CANCEL e-tagging any version of the request wins
// over the request's own status field.
export function rideStatus(request) {
  return cached("s:" + request.id, () => computeStatus(request));
}
function computeStatus(request) {
  const base = parse(request)?.status || "requested";
  if (base === "cancelled") return "cancelled";
  const parties = rideParties(request);
  if (findCancel(parties)) return "cancelled";
  if (base === "completed") return "completed";
  if (findComplete(parties)) return "completed";
  return base;
}

// Who ended the ride (and when) — for messaging on the other party's screen.
export function rideEnding(request) {
  return cached("end:" + request.id, () => computeEnding(request));
}
function computeEnding(request) {
  const parties = rideParties(request);
  const cancel = findCancel(parties);
  if (cancel) return { type: "cancelled", by: cancel.pubkey, at: cancel.created_at };
  const done = findComplete(parties);
  if (done) return { type: "completed", by: done.pubkey, at: done.created_at };
  return null;
}

// Reputation for one pubkey, separated by role (rider vs driver).
// Reads the local cache (already synced from relays).
export function reputation(pubkey) {
  return cached("rep:" + pubkey, () => computeReputation(pubkey));
}
const addrOf = (e) => `${e.pubkey}:${dtagOf(e)}`;

// All requests by id, and the newest version per address — built once
// per cache change and shared by every reputation() call.
function requestIndex() {
  return cached("reqIndex", () => {
    const byId = {};
    const latestByAddr = {}; // "pubkey:d" -> newest version
    relay.query({ kinds: [EVENT_KINDS.RIDE_REQUEST] }).forEach((e) => {
      byId[e.id] = e;
      if (!dtagOf(e)) return;
      const a = addrOf(e);
      if (!latestByAddr[a] || e.created_at > latestByAddr[a].created_at) latestByAddr[a] = e;
    });
    return { byId, latestByAddr, latest: Object.values(latestByAddr) };
  });
}

function computeReputation(pubkey) {
  const { byId, latestByAddr, latest } = requestIndex();

  const rides = latest.filter((e) => e.pubkey === pubkey && rideStatus(e) === "completed").length;
  const drives = latest.filter((e) => parse(e)?.driverPubkey === pubkey && rideStatus(e) === "completed").length;

  // One score per (rater, ride): the newest rating wins.
  const riderScores = new Map();
  const driverScores = new Map();
  relay.query({ kinds: [EVENT_KINDS.RATING], "#p": [pubkey] }).forEach((rt) => {
    const c = parse(rt);
    if (!c || typeof c.rating !== "number" || c.rating < 1 || c.rating > 5) return;
    const orig = byId[etagOf(rt)];
    if (!orig) return;
    const latestVer = (dtagOf(orig) && latestByAddr[addrOf(orig)]) || orig;
    const driver = parse(latestVer)?.driverPubkey;
    const key = `${rt.pubkey}|${addrOf(orig)}`;
    // They were the rider → only their driver may rate them, and vice versa.
    const target =
      orig.pubkey === pubkey && driver && rt.pubkey === driver ? riderScores
      : driver === pubkey && rt.pubkey === orig.pubkey ? driverScores
      : null;
    if (!target) return;
    const prev = target.get(key);
    if (!prev || rt.created_at > prev.at) target.set(key, { at: rt.created_at, rating: c.rating });
  });

  const avg = (m) => {
    const arr = [...m.values()].map((v) => v.rating);
    return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
  };
  return {
    rides,
    drives,
    riderReviews: { count: riderScores.size, avg: avg(riderScores) },
    driverReviews: { count: driverScores.size, avg: avg(driverScores) },
  };
}
