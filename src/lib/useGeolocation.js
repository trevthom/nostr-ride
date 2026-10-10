// ════════════════════════════════════════════════════════════
//  useGeolocation — React hook around the browser's GPS.
//  While `enabled` is true it watches the device location and returns
//    { pos: {lat,lng,accuracy} | null, error: string, status }
//  `status` (see lib/gps.js) says whether the fix is good, weak or stale.
//  It is re-checked every 10 s, so a lost signal turns "stale" on its own.
//
//  Notes:
//   • The browser shows a permission prompt the first time.
//   • Geolocation only works on https:// or http://localhost
//     (so `npm run dev` is fine; a deployed site needs HTTPS).
//   • Browsers pause GPS while the tab is hidden (see useWakeLock).
// ════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react";
import { haversineDistance } from "./geo.js";
import { gpsStatus, geoErrorText } from "./gps.js";

const MIN_MOVE_METERS = 5; // smaller moves are GPS jitter: skip the re-render

export function useGeolocation(enabled) {
  const [pos, setPos] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("searching");
  const raw = useRef({ pos: null, seenAt: 0, error: "" }); // latest fix, even if not re-rendered

  useEffect(() => {
    if (!enabled) {
      raw.current = { pos: null, seenAt: 0, error: "" };
      setPos(null);
      setError("");
      setStatus("searching");
      return;
    }
    if (!("geolocation" in navigator)) {
      setError("This browser doesn't support location.");
      setStatus("error");
      return;
    }

    // GPS fires about once a second even when standing still; every new
    // position re-renders the whole app, so ignore jitter.
    let last = null;
    const refresh = () => setStatus(gpsStatus(raw.current));
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const next = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
        raw.current = { pos: next, seenAt: Date.now(), error: "" };
        setError(""); // a fix arrived; clear any old error (no re-render if already "")
        refresh();
        const moved = last ? haversineDistance(last.lat, last.lng, next.lat, next.lng) * 1609.344 : Infinity;
        if (moved < MIN_MOVE_METERS && Math.abs(next.accuracy - last.accuracy) < MIN_MOVE_METERS) return;
        last = next;
        setPos(next);
      },
      (e) => {
        const text = geoErrorText(e);
        raw.current = { ...raw.current, error: text };
        setError(text);
        refresh();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
    const timer = setInterval(refresh, 10000); // a silent GPS must turn "stale"

    return () => { navigator.geolocation.clearWatch(id); clearInterval(timer); };
  }, [enabled]);

  return { pos, error, status };
}
