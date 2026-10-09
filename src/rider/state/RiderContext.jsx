// ════════════════════════════════════════════════════════════
//  RIDER STATE — Everything only the rider app needs, on top of the
//  shared useApp() state:
//    • the rider's GPS position and a name for it ("here")
//    • online drivers nearby (public presence from the relays)
//    • the trip being planned (pickup, dropoff, when, notes)
//    • the CURRENT ride, derived from signed events (so a reload or
//      another device shows the same screen) and the receipt to show
//      after a trip
//    • actions: requestRide, confirmDriver, cancelRide, rateDriver
//  Banners: offers arriving, driver arrived, trip done, driver cancelled.
// ════════════════════════════════════════════════════════════

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useApp } from "../../state/AppContext.jsx";
import { relay } from "../../nostr/relay.js";
import { EVENT_KINDS } from "../../nostr/eventKinds.js";
import { subscribePresence } from "../../nostr/live.js";
import { useGeolocation } from "../../lib/useGeolocation.js";
import { reverseGeocode } from "../../lib/geocode.js";
import { haversineDistance } from "../../lib/geo.js";
import { pickupEta } from "../../lib/fare.js";
import { publicPlace, seal, exactTrip } from "../../lib/privacy.js";
import { activeRideFor, isOpenRide, upcomingRidesFor } from "../../lib/trips.js";
import { rideDriver, rideEnding, rideKey, rideStatus, rideVersions } from "../../lib/rides.js";
import { getSetting, setSetting } from "../../config/relays.js";

const RiderContext = createContext(null);
export const useRider = () => useContext(RiderContext);

const HOUR = 3600000;
const EMPTY_PLAN = { step: "idle", pickup: null, dropoff: null, when: "ASAP", notes: "" };
const parse = (e) => { try { return JSON.parse(e.content); } catch { return null; } };

export function RiderProvider({ children }) {
  const { user, rideRequests, publish, refreshData, pullRecent, pushNotice, liveTick, setView } = useApp();
  const me = user.publicKey;
  const { pos: myPosition, error: geoError } = useGeolocation(true);

  // ── Where am I, by name? (one lookup per ~300 m of movement) ──
  const [here, setHere] = useState(null);
  const hereAt = useRef(null);
  useEffect(() => {
    if (!myPosition) return;
    const last = hereAt.current;
    if (last && haversineDistance(last.lat, last.lng, myPosition.lat, myPosition.lng) < 0.2) return;
    hereAt.current = { lat: myPosition.lat, lng: myPosition.lng };
    let alive = true;
    const fallback = { name: "Current location", fullName: "Current location", area: "Near you", lat: myPosition.lat, lng: myPosition.lng };
    reverseGeocode(myPosition.lat, myPosition.lng)
      .then((p) => alive && setHere(p || fallback))
      .catch(() => alive && setHere(fallback));
    return () => { alive = false; };
  }, [myPosition?.lat, myPosition?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Online drivers nearby (public, coarsened presence) ──
  const [allDrivers, setAllDrivers] = useState([]);
  useEffect(() => subscribePresence(setAllDrivers, { excludePubkey: me }), [me]);
  const drivers = myPosition
    ? allDrivers.filter((d) => haversineDistance(myPosition.lat, myPosition.lng, d.lat, d.lng) <= 25)
    : allDrivers;

  // ── The trip being planned ──
  const [plan, setPlanState] = useState(EMPTY_PLAN);
  const setPlan = useCallback((patch) => setPlanState((p) => ({ ...p, ...patch })), []);
  const resetPlan = useCallback(() => setPlanState(EMPTY_PLAN), []);

  // ── The current ride, from events ──
  void liveTick; // re-derive when relay events arrive
  // A reservation the rider opened from Activity takes the home screen until
  // closed (or until a driver is confirmed, which makes it the active ride).
  const [focusId, setFocusId] = useState(null);
  const focused = focusId ? rideRequests.find((r) => r.id === focusId && isOpenRide(r)) : null;
  const activeRide = focused || activeRideFor(rideRequests, me);
  const upcoming = upcomingRidesFor(rideRequests, me);

  // ── The receipt to show after a trip ends ──
  const [doneKeys, setDoneKeys] = useState(() => getSetting("riderDone", []));
  const receipt =
    rideRequests
      .filter((r) => r.pubkey === me && !doneKeys.includes(rideKey(r)))
      .map((r) => ({ r, end: rideEnding(r) }))
      .filter(({ r, end }) => {
        if (!end || Date.now() - end.at * 1000 > 6 * HOUR) return false;
        const status = rideStatus(r);
        if (status === "completed") return true;
        // A cancel by the driver is news; one by me is not.
        return status === "cancelled" && end.by !== me && !!rideDriver(r);
      })
      .sort((a, b) => b.end.at - a.end.at)[0]?.r || null;
  const dismissReceipt = useCallback((request) => {
    setDoneKeys((keys) => {
      const next = [...keys, rideKey(request)].slice(-100);
      setSetting("riderDone", next);
      return next;
    });
  }, []);

  // While a ride is open, poll so the driver's moves show up even if the
  // live subscription missed them.
  const rideOpen = !!activeRide;
  useEffect(() => {
    if (!rideOpen) return;
    const id = setInterval(() => pullRecent(), 6000);
    return () => clearInterval(id);
  }, [rideOpen, pullRecent]);

  // ── Banners for what the driver does ──
  useEffect(() => {
    const since = Math.floor(Date.now() / 1000) - 60;
    return relay.onEvent((_id, ev) => {
      if (ev.pubkey === me || ev.created_at < since) return;
      if (!(ev.tags || []).some((t) => t[0] === "p" && t[1] === me)) return;
      const c = parse(ev);
      if (ev.kind === EVENT_KINDS.RIDE_OFFER) pushNotice("A driver can pick you up. Check the offer.");
      else if (ev.kind === EVENT_KINDS.RIDE_STAGE && c?.stage === "arrived") pushNotice("Your driver has arrived.");
      else if (ev.kind === EVENT_KINDS.RIDE_COMPLETE) pushNotice("Your trip is complete.");
      else if (ev.kind === EVENT_KINDS.RIDE_CANCEL) pushNotice("Your driver cancelled the ride.");
    });
  }, [me, pushNotice]);

  // ── Actions ──
  const [sendFailed, setSendFailed] = useState(false);

  // Publish a ride request. Only an approximate area is public; the exact
  // trip is sealed to the rider (and to the driver after they are chosen).
  const requestRide = useCallback(
    ({ pickup, dropoff, when, notes, miles, minutes, fareSats }) => {
      setSendFailed(false);
      const sent = publish(
        EVENT_KINDS.RIDE_REQUEST,
        {
          pickup: publicPlace(pickup),
          dropoff: publicPlace(dropoff),
          time: when,
          notes,
          status: "requested",
          fareSats,
          distanceMiles: Math.round(miles * 10) / 10,
          durationMin: minutes,
          sealed: seal(user.sk, me, { pickup, dropoff }),
        },
        [["d", "ride-" + Date.now()], ["t", "ride-request"]]
      );
      refreshData();
      resetPlan();
      sent.then((ok) => setSendFailed(!ok));
      // A reservation doesn't take over the home screen, so say where it went.
      if (when !== "ASAP" && Date.parse(when) - Date.now() > 30 * 60000) {
        pushNotice(`Ride reserved for ${new Date(when).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}. Drivers can accept it from now on.`);
        setView("activity");
      }
    },
    [publish, refreshData, resetPlan, user.sk, me, pushNotice, setView]
  );

  // The rider picked a driver and paid the deposit: accept the offer and
  // hand the driver the exact trip.
  const confirmDriver = useCallback(
    (request, offerEvent, { verified = false } = {}) => {
      const driver = offerEvent.pubkey;
      const offer = parse(offerEvent) || {};
      const trip = exactTrip(request, user);
      publish(
        EVENT_KINDS.RIDE_ACCEPT,
        {
          offerId: offerEvent.id,
          requestId: request.id,
          paidSats: offer.upfrontSats || 0,
          verified,
          ...(trip && { sealed: seal(user.sk, driver, trip) }),
        },
        [["e", offerEvent.id], ["e", request.id], ["p", driver], ["d", "accept-" + request.id], ["t", "ride-accept"]]
      );
      publish(
        EVENT_KINDS.RIDE_REQUEST,
        { ...parse(request), status: "in_progress", driverPubkey: driver },
        // p-tag the driver so their app can find this ride on the relays.
        [...request.tags.filter((t) => t[0] !== "p"), ["p", driver]]
      );
      refreshData();
    },
    [publish, refreshData, user]
  );

  // Cancel the ride (open or running). A running ride tells the driver.
  const cancelRide = useCallback(
    (request) => {
      const latest = rideVersions(request)[0] || request;
      const driver = rideDriver(latest);
      publish(
        EVENT_KINDS.RIDE_CANCEL,
        { requestId: latest.id, reason: "Cancelled by rider" },
        [["e", latest.id], ...(driver ? [["p", driver]] : []), ["d", "cancel-" + latest.id], ["t", "ride-cancel"]]
      );
      // An open request is also re-published as cancelled so other clients drop it.
      if (!driver) publish(EVENT_KINDS.RIDE_REQUEST, { ...parse(latest), status: "cancelled" }, latest.tags);
      refreshData();
    },
    [publish, refreshData]
  );

  const rateDriver = useCallback(
    (request, driverPubkey, rating, review) => {
      publish(
        EVENT_KINDS.RATING,
        { rating, review, rideId: request.id },
        [["p", driverPubkey], ["e", request.id], ["d", "rating-" + request.id], ["t", "rating"]]
      );
    },
    [publish]
  );

  // Places the rider has been to, newest first (for quick "Where to?" picks).
  const recentPlaces = () => {
    const seen = new Set();
    const out = [];
    rideRequests
      .filter((r) => r.pubkey === me)
      .sort((a, b) => b.created_at - a.created_at)
      .forEach((r) => {
        const d = exactTrip(r, user)?.dropoff;
        // The public copy of the dropoff names only the area; keep it so a
        // repeat trip publishes the same coarse label.
        if (d && !seen.has(d.name) && out.length < 4) { seen.add(d.name); out.push({ ...d, area: parse(r)?.dropoff?.name || "" }); }
      });
    return out;
  };

  const value = {
    myPosition, geoError, here, drivers,
    plan, setPlan, resetPlan,
    activeRide, focused: !!focused, focusRide: (r) => setFocusId(r ? r.id : null), upcoming, receipt, dismissReceipt,
    sendFailed, requestRide, confirmDriver, cancelRide, rateDriver, recentPlaces,
    nearestDriverEta: (to) => {
      if (!to || !drivers.length) return null;
      const miles = Math.min(...drivers.map((d) => haversineDistance(to.lat, to.lng, d.lat, d.lng)));
      return pickupEta(miles);
    },
  };
  return <RiderContext.Provider value={value}>{children}</RiderContext.Provider>;
}
