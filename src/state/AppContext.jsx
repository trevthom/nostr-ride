// ════════════════════════════════════════════════════════════
//  APP STATE — One place that holds everything the whole app needs:
//  the logged-in user, which screen is showing, the ride lists,
//  notifications, and the connected Lightning wallet.
//
//  Any screen can read/update this with the useApp() hook, e.g.:
//      const { user, setView } = useApp();
// ════════════════════════════════════════════════════════════

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { relay } from "../nostr/relay.js";
import { EVENT_KINDS, APP_TAG } from "../nostr/eventKinds.js";
import { buildSignedEvent } from "../nostr/events.js";
import { seedDemoData } from "../nostr/demoData.js";
import { latestVersions } from "../nostr/replaceable.js";
import { emptyWalletState } from "../nostr/wallet.js";
import { publishPresence } from "../nostr/live.js";
import { useGeolocation } from "../lib/useGeolocation.js";
import { haversineDistance } from "../lib/geo.js";
import { isRideExpired } from "../lib/rides.js";
import { getProfile } from "../nostr/profiles.js";
import { DEFAULT_NOTIFY_RADIUS_MILES } from "../config/settings.js";
import { getSetting, setSetting } from "../config/relays.js";

const AppContext = createContext(null);

// Kinds whose arrival should refresh on-screen data.
const APP_EVENT_KINDS = new Set([
  EVENT_KINDS.RIDE_REQUEST,
  EVENT_KINDS.RIDE_OFFER,
  EVENT_KINDS.RIDE_ACCEPT,
  EVENT_KINDS.RIDE_CANCEL,
  EVENT_KINDS.RIDE_COMPLETE,
  EVENT_KINDS.RATING,
]);

// The hook every screen uses to reach shared state.
export function useApp() {
  return useContext(AppContext);
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null); // logged-in keypair + profile
  const [view, setView] = useState("rider-request"); // which screen is visible
  const [rideRequests, setRideRequests] = useState([]); // latest version of each
  const [selectedRequest, setSelectedRequest] = useState(null); // request in focus
  const [activeRide, setActiveRide] = useState(null); // ride in progress
  const [profileModalPubkey, setProfileModalPubkey] = useState(null); // user-info modal
  const [notices, setNotices] = useState([]); // transient swipe-away banners

  // Show a transient banner. Also fires a system notification when the app
  // isn't the focused tab, so users hear about it off-screen.
  const pushNotice = useCallback((message) => {
    const id = Math.random().toString(36).slice(2);
    setNotices((list) => [...list, { id, message }]);
    try {
      if (typeof document !== "undefined" && document.hidden &&
          typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("NostrRide", { body: message });
      }
    } catch { /* ignore */ }
    return id;
  }, []);
  const dismissNotice = useCallback((id) => setNotices((list) => list.filter((n) => n.id !== id)), []);
  const [notifications, setNotifications] = useState([]); // driver/rider alerts
  const [liveTick, setLiveTick] = useState(0); // bumped on incoming relay events to re-render

  // BTC price (USD) so sats amounts can show a fiat estimate. Refreshed
  // periodically; null until first fetch (then USD is just hidden).
  const [btcUsd, setBtcUsd] = useState(null);
  useEffect(() => {
    let alive = true;
    const fetchPrice = async () => {
      try {
        const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd");
        const data = await res.json();
        if (alive && data?.bitcoin?.usd) setBtcUsd(data.bitcoin.usd);
      } catch {
        /* leave null; USD just won't show */
      }
    };
    fetchPrice();
    const id = setInterval(fetchPrice, 5 * 60 * 1000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  const [wallet, setWallet] = useState(emptyWalletState()); // connected NWC wallet
  const [driverOnline, setDriverOnline] = useState(false); // "offering rides" presence toggle
  const [locating, setLocating] = useState(false); // request GPS while on the Drive tab

  // Driver "notify me of nearby ride requests" preference (persisted).
  const [notifyNearby, setNotifyNearbyState] = useState(() => getSetting("notifyNearby", false));
  const [notifyRadius, setNotifyRadiusState] = useState(() => getSetting("notifyRadius", DEFAULT_NOTIFY_RADIUS_MILES));
  const setNotifyNearby = useCallback((v) => { setNotifyNearbyState(v); setSetting("notifyNearby", v); }, []);
  const setNotifyRadius = useCallback((v) => { setNotifyRadiusState(v); setSetting("notifyRadius", v); }, []);

  // Watch the device location while online OR while nearby-notifications
  // are on, and (when online) broadcast presence to relays every 15s.
  const { pos: myPosition, error: geoError } = useGeolocation(driverOnline || notifyNearby || locating);
  const posRef = useRef(null);
  useEffect(() => { posRef.current = myPosition; }, [myPosition]);
  useEffect(() => {
    if (!driverOnline || !user) return;
    const beat = () => { if (posRef.current) publishPresence(user, posRef.current); };
    beat(); // publish immediately once we're online
    const id = setInterval(beat, 15000);
    return () => clearInterval(id);
  }, [driverOnline, user]);

  // Load demo data + connect to real relays once when the app starts.
  useEffect(() => {
    seedDemoData();
    relay.startSync();
  }, []);

  // Re-read the latest ride requests from the cache (newest per request),
  // skipping anything malformed or not shaped like a ride.
  const refreshData = useCallback(() => {
    const reqs = latestVersions(relay.query({ kinds: [EVENT_KINDS.RIDE_REQUEST] })).filter((r) => {
      try {
        const c = JSON.parse(r.content);
        return c && c.pickup && c.dropoff;
      } catch {
        return false;
      }
    });
    setRideRequests(reqs);
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Pull recent events from the relays, then refresh the list. Used by
  // the Drive Refresh button and a periodic poll.
  const pullRecent = useCallback(async () => {
    await relay.fetchRecent();
    refreshData();
  }, [refreshData]);

  // On startup, also do a one-shot pull so existing requests appear.
  useEffect(() => {
    pullRecent();
  }, [pullRecent]);

  // Publish a REAL signed event authored by the logged-in user, to the
  // local cache + the real relays. This is how every user action is sent.
  const publish = useCallback(
    (kind, content, tags) => {
      if (!user?.sk) return;
      // Tag every event so other devices can tell our events apart from
      // unrelated apps that reuse the same kind numbers on public relays.
      const tagged = [...tags, ["t", APP_TAG]];
      relay.publish(buildSignedEvent(kind, content, tagged, user.sk));
    },
    [user]
  );

  // Cancel one of the current user's own ride requests: publish a cancel
  // event AND a replacing request marked "cancelled".
  const cancelRequest = useCallback(
    (requestEvent) => {
      const content = JSON.parse(requestEvent.content);
      const reqId = requestEvent.tags.find((t) => t[0] === "d")?.[1] || requestEvent.id;
      publish(
        EVENT_KINDS.RIDE_CANCEL,
        { requestId: requestEvent.id, reason: "Cancelled by rider" },
        [["e", requestEvent.id], ["d", reqId], ["t", "ride-cancel"]]
      );
      publish(
        EVENT_KINDS.RIDE_REQUEST,
        { ...content, status: "cancelled" },
        requestEvent.tags // same "d" tag => replaces the request
      );
      refreshData();
    },
    [publish, refreshData]
  );

  // Watch for new events that should refresh the UI and notify the user.
  useEffect(() => {
    if (!user) return;
    const unsub = relay.onEvent((_subId, event) => {
      if (event.kind === EVENT_KINDS.RIDE_REQUEST) refreshData();
      if (APP_EVENT_KINDS.has(event.kind)) setLiveTick((t) => t + 1);
      if (event.pubkey === user.publicKey) return; // don't notify about our own actions

      const pTags = event.tags.filter((t) => t[0] === "p").map((t) => t[1]);
      const c = (() => { try { return JSON.parse(event.content); } catch { return null; } })();

      if (event.kind === EVENT_KINDS.RIDE_OFFER && pTags.includes(user.publicKey)) {
        pushNotice("New offer on your ride request.");
      } else if (event.kind === EVENT_KINDS.RIDE_REQUEST && c?.status === "in_progress" && c?.driverPubkey === user.publicKey) {
        pushNotice("Your offer was accepted — the ride has started.");
      } else if (event.kind === EVENT_KINDS.RIDE_COMPLETE && pTags.includes(user.publicKey)) {
        pushNotice("Your driver marked the ride complete.");
      } else if (event.kind === EVENT_KINDS.RIDE_CANCEL && pTags.includes(user.publicKey)) {
        pushNotice("The other rider/driver cancelled the ride.");
      }
    });
    return unsub;
  }, [user, refreshData, pushNotice]);

  // Best-effort: ask for system-notification permission once logged in.
  useEffect(() => {
    if (!user) return;
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    } catch { /* ignore */ }
  }, [user?.publicKey]);

  // Open ride requests near the driver (for the Drive-tab notification
  // bubble). Empty unless notifications are on and we have a location.
  // Naturally clears when a request is cancelled or taken (status != requested).
  const nearbyRequests =
    notifyNearby && myPosition
      ? rideRequests.filter((r) => {
          const c = JSON.parse(r.content);
          if (c.status !== "requested") return false;
          if (r.pubkey === user?.publicKey) return false; // not my own
          if (isRideExpired(c, r.created_at)) return false; // expired
          const d = haversineDistance(myPosition.lat, myPosition.lng, c.pickup.lat, c.pickup.lng);
          return d <= notifyRadius;
        })
      : [];
  const nearbyRequestCount = nearbyRequests.length;

  // Log out: clear the session and return to the login screen.
  const logout = useCallback(() => {
    setUser(null);
    setActiveRide(null);
    setSelectedRequest(null);
    setDriverOnline(false);
    setProfileModalPubkey(null);
    setView("rider-request");
  }, []);

  // On login, pull our own profile from relays and restore the photo +
  // vehicle info (so a returning driver keeps their setup across sessions).
  useEffect(() => {
    if (!user?.publicKey) return;
    let alive = true;
    (async () => {
      await relay.fetchProfile(user.publicKey);
      const p = getProfile(user.publicKey);
      if (alive && p && (p.picture || p.vehicle)) {
        setUser((u) => ({
          ...u,
          picture: u.picture || p.picture || "",
          vehicle: u.vehicle || p.vehicle || null,
        }));
      }
    })();
    return () => { alive = false; };
  }, [user?.publicKey]);

  // User-info modal (opened by tapping any username).
  const openProfile = useCallback((pubkey) => setProfileModalPubkey(pubkey), []);
  const closeProfile = useCallback(() => setProfileModalPubkey(null), []);

  const value = {
    user,
    setUser,
    logout,
    openProfile,
    closeProfile,
    profileModalPubkey,
    notices,
    pushNotice,
    dismissNotice,
    view,
    setView,
    rideRequests,
    refreshData,
    pullRecent,
    publish,
    cancelRequest,
    selectedRequest,
    setSelectedRequest,
    activeRide,
    setActiveRide,
    notifications,
    wallet,
    setWallet,
    driverOnline,
    setDriverOnline,
    setLocating,
    myPosition,
    geoError,
    liveTick,
    btcUsd,
    notifyNearby,
    setNotifyNearby,
    notifyRadius,
    setNotifyRadius,
    nearbyRequests,
    nearbyRequestCount,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
