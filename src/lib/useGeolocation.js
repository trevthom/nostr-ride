// ════════════════════════════════════════════════════════════
//  useGeolocation — React hook around the browser's GPS.
//  While `enabled` is true it watches the device location and
//  returns { pos: {lat,lng,accuracy} | null, error: string }.
//
//  Notes:
//   • The browser shows a permission prompt the first time.
//   • Geolocation only works on https:// or http://localhost
//     (so `npm run dev` is fine; a deployed site needs HTTPS).
// ════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { haversineDistance } from "./geo.js";

const MIN_MOVE_METERS = 5; // smaller moves are GPS jitter: skip the re-render

export function useGeolocation(enabled) {
  const [pos, setPos] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) {
      setPos(null);
      setError("");
      return;
    }
    if (!("geolocation" in navigator)) {
      setError("This browser doesn't support location.");
      return;
    }

    // GPS fires about once a second even when standing still; every new
    // position re-renders the whole app, so ignore jitter.
    let last = null;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setError(""); // a fix arrived; clear any old error (no re-render if already "")
        const next = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
        const moved = last ? haversineDistance(last.lat, last.lng, next.lat, next.lng) * 1609.344 : Infinity;
        if (moved < MIN_MOVE_METERS && Math.abs(next.accuracy - last.accuracy) < MIN_MOVE_METERS) return;
        last = next;
        setPos(next);
      },
      (e) => setError(e.message || "Couldn't get your location."),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return { pos, error };
}
