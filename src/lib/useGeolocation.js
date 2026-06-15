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

    const id = navigator.geolocation.watchPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
        setError("");
      },
      (e) => setError(e.message || "Couldn't get your location."),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return { pos, error };
}
