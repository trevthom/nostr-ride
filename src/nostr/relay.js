// ════════════════════════════════════════════════════════════
//  RELAY — Stores and serves Nostr events for the whole app.
//
//  Connects to REAL Nostr relays (config/relays.js) via nostr-tools'
//  SimplePool, AND keeps a local in-memory cache. The cache lets the
//  rest of the app read events synchronously with query(); publish()
//  also broadcasts to the relays so OTHER devices see your events.
//
//  Two ingestion paths:
//    • _store  — TRUSTED: our own events (publish / publishLocal).
//    • _ingest — UNTRUSTED: events pulled from relays. These are
//      validated first, because kinds like 30078 are shared with other
//      Nostr apps (NIP-78); their content isn't our JSON. We accept a
//      relay event only if it carries our app tag AND has JSON content.
//
//  Safety: if relays are unreachable, publish()/query() still work
//  against the cache, so the app degrades to "local only".
// ════════════════════════════════════════════════════════════

import { SimplePool } from "nostr-tools/pool";
import { EVENT_KINDS, APP_TAG } from "./eventKinds.js";
import { getRelays, onRelaysChange } from "../config/relays.js";

// The app's kinds we sync from relays (NOT kind 0 / presence).
const APP_KINDS = [
  EVENT_KINDS.RIDE_REQUEST,
  EVENT_KINDS.RIDE_OFFER,
  EVENT_KINDS.RIDE_ACCEPT,
  EVENT_KINDS.RIDE_CANCEL,
  EVENT_KINDS.RIDE_COMPLETE,
  EVENT_KINDS.RATING,
];

const nowSec = () => Math.floor(Date.now() / 1000);

// Only our events on shared relays: must carry the app tag and have
// JSON-parseable content.
function isOurs(event) {
  if (!event || !event.content) return false;
  try { JSON.parse(event.content); } catch { return false; }
  return (event.tags || []).some((t) => t[0] === "t" && t[1] === APP_TAG);
}

class NostrRelay {
  constructor() {
    this.pool = new SimplePool();
    this.events = [];
    this.seen = new Set(); // event ids, for de-duping
    this.listeners = new Set();
    this.sub = null;
    this.syncing = false;
    // If the relay list changes (added/removed in-app), reconnect.
    onRelaysChange(() => { if (this.syncing) this._resubscribe(); });
  }

  // Connect to the real relays and stream the app's events into the
  // cache. Safe to call once at startup.
  startSync() {
    if (this.syncing) return;
    this.syncing = true;
    this._resubscribe();
  }

  _resubscribe() {
    try { this.sub && this.sub.close(); } catch { /* ignore */ }
    try {
      this.sub = this.pool.subscribeMany(
        getRelays(),
        [{ kinds: APP_KINDS, "#t": [APP_TAG], since: nowSec() - 86400 }], // only our events, last 24h
        { onevent: (ev) => this._ingest(ev) }
      );
    } catch (e) {
      console.error("Relay sync failed (running local-only):", e);
    }
  }

  // Pull one user's profile (kind 0) from relays into the cache, so we
  // can show their display name (we don't sync the global kind-0 firehose).
  async fetchProfile(pubkey) {
    if (!pubkey) return;
    try {
      const events = await this.pool.querySync(getRelays(), { kinds: [EVENT_KINDS.METADATA], authors: [pubkey] });
      events.forEach((e) => this._ingest(e)); // METADATA is exempt from the app-tag check
    } catch {
      /* ignore */
    }
  }

  // One-shot pull of recent app events from the relays into the cache.
  // Used by the Drive "Refresh" button and a periodic poll.
  async fetchRecent() {
    try {
      const events = await this.pool.querySync(getRelays(), {
        kinds: APP_KINDS,
        "#t": [APP_TAG],
        since: nowSec() - 86400,
      });
      let added = 0;
      events.forEach((e) => { if (this._ingest(e)) added++; });
      return added;
    } catch (e) {
      console.error("Relay fetch failed:", e);
      return 0;
    }
  }

  // Publish: cache (trusted) + broadcast to relays.
  publish(event) {
    this._store(event);
    try {
      this.pool.publish(getRelays(), event);
    } catch (e) {
      console.error("Relay publish failed (kept locally):", e);
    }
  }

  // Cache only (demo data / our own events that shouldn't hit relays).
  publishLocal(event) {
    this._store(event);
  }

  // Synchronous read from the local cache.
  query(filter) {
    return this.events.filter((e) => this._matches(e, filter));
  }

  // Kept for API compatibility; returns current cache matches.
  subscribe(_id, filter) {
    return this.query(filter);
  }

  onEvent(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // TRUSTED add (our own events). Always stored.
  _store(event) {
    if (this.seen.has(event.id)) return false;
    this.seen.add(event.id);
    this.events.push(event);
    this.listeners.forEach((fn) => { try { fn("__all__", event); } catch { /* ignore */ } });
    return true;
  }

  // UNTRUSTED add (relay-sourced). Validated before storing so other
  // apps' events on the same kinds can never reach the screens.
  _ingest(event) {
    if (this.seen.has(event.id)) return false;
    if (event.kind !== EVENT_KINDS.METADATA && !isOurs(event)) return false;
    return this._store(event);
  }

  _matches(event, filter) {
    if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
    if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
    for (const tag of ["e", "d", "p"]) {
      const key = "#" + tag;
      if (filter[key]) {
        const values = event.tags.filter((t) => t[0] === tag).map((t) => t[1]);
        if (!filter[key].some((v) => values.includes(v))) return false;
      }
    }
    return true;
  }
}

export const relay = new NostrRelay();
