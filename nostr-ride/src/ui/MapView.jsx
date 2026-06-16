// ════════════════════════════════════════════════════════════
//  MAP VIEW — A real interactive map using Leaflet + free
//  OpenStreetMap tiles. Leaflet renders raster tiles with plain DOM
//  elements (no WebGL, no web worker), so it works in essentially any
//  browser — unlike WebGL maps, which fail where the GPU/WebGL is
//  unavailable.
//
//  Three uses, by prop:
//   • Route preview:  pickup + dropoff (+ optional waypoints)
//                     → draws the OSRM driving route, fits to it.
//   • Live drivers:   drivers=[{pubkey,lat,lng,name,vehicle,self}]
//                     → shows a marker per driver, fits to them.
//
//  Everything that touches Leaflet is wrapped in try/catch so a map
//  failure shows a small fallback instead of crashing the app.
// ════════════════════════════════════════════════════════════

import { useRef, useEffect, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getDrivingRoute } from "../lib/routing.js";
import { SAMPLE_LOCATIONS } from "../lib/locations.js";

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTR = "© OpenStreetMap contributors";
const DEFAULT_CENTER = [SAMPLE_LOCATIONS[0].lat, SAMPLE_LOCATIONS[0].lng]; // [lat, lng]

// A colored dot marker (no image assets needed → bundler-safe).
function dot(lat, lng, color) {
  return L.circleMarker([lat, lng], {
    radius: 8,
    color: "#ffffff",
    weight: 2,
    fillColor: color,
    fillOpacity: 1,
  });
}

// A small car marker for live drivers (HTML, no image assets).
function carMarker(d) {
  const icon = L.divIcon({
    className: "",
    html: `<div style="width:30px;height:30px;border-radius:50%;display:flex;
      align-items:center;justify-content:center;font-size:15px;
      box-shadow:0 1px 4px rgba(0,0,0,0.4);
      background:${d.self ? "#06b6d4" : "#ffffff"};
      border:2px solid ${d.self ? "#a5f3fc" : "#0ea5e9"};">🚗</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
  return L.marker([d.lat, d.lng], { icon });
}

export default function MapView({ pickup, dropoff, waypoints, drivers, height = 260 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null); // group holding markers + route line
  const reqIdRef = useRef(0);
  const fittedDriversRef = useRef(false);
  const [failed, setFailed] = useState(false);

  // Initialise the map once.
  useEffect(() => {
    let map;
    try {
      map = L.map(containerRef.current, { zoomControl: true, attributionControl: true });
      map.setView(DEFAULT_CENTER, 11);
      L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      // Leaflet sometimes needs a size recalc once laid out.
      setTimeout(() => { try { map.invalidateSize(); } catch { /* ignore */ } }, 0);
      draw();
    } catch (e) {
      console.error("Map init failed:", e);
      setFailed(true);
    }
    return () => {
      try { map && map.remove(); } catch { /* ignore */ }
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw whenever inputs change.
  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup, dropoff, waypoints, drivers]);

  function draw() {
    const map = mapRef.current;
    const group = layerRef.current;
    if (!map || !group) return;
    try {
      group.clearLayers();

      // Live-drivers mode.
      if (drivers) {
        const latlngs = [];
        drivers.forEach((d) => {
          carMarker(d)
            .bindPopup(`<b>${d.self ? "You" : d.name || "Driver"}</b>${d.vehicle ? " · " + d.vehicle : ""}`)
            .addTo(group);
          latlngs.push([d.lat, d.lng]);
        });
        // Auto-fit only ONCE (the first time we have markers). After that,
        // leave the viewport alone so the user can pan/zoom to find cars —
        // otherwise frequent location updates keep snapping back to them.
        if (!fittedDriversRef.current && latlngs.length > 0) {
          fit(latlngs);
          fittedDriversRef.current = true;
        }
        return;
      }

      // Route mode.
      const endpoints = [];
      if (pickup) { dot(pickup.lat, pickup.lng, "#10b981").addTo(group); endpoints.push(pickup); }
      (waypoints || []).forEach((w) => dot(w.lat, w.lng, "#f59e0b").addTo(group));
      if (dropoff) { dot(dropoff.lat, dropoff.lng, "#f43f5e").addTo(group); endpoints.push(dropoff); }
      drawRoute(waypoints && waypoints.length >= 2 ? waypoints : endpoints);
    } catch (e) {
      console.error("Map draw failed:", e);
    }
  }

  function fit(latlngs) {
    const map = mapRef.current;
    if (!map || latlngs.length === 0) return;
    try {
      if (latlngs.length === 1) {
        map.setView(latlngs[0], 13);
        return;
      }
      map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40], maxZoom: 14 });
    } catch { /* ignore */ }
  }

  async function drawRoute(pts) {
    const group = layerRef.current;
    if (!group) return;
    const myReq = ++reqIdRef.current;
    if (!pts || pts.length === 0) return;
    if (pts.length === 1) { fit([[pts[0].lat, pts[0].lng]]); return; }

    // straight-line latlngs as fallback
    let latlngs = pts.map((p) => [p.lat, p.lng]);
    try {
      const route = await getDrivingRoute(pts);
      // OSRM returns [lng, lat]; Leaflet wants [lat, lng]
      if (route?.coordinates?.length) latlngs = route.coordinates.map((c) => [c[1], c[0]]);
    } catch { /* keep straight-line */ }
    if (myReq !== reqIdRef.current || !layerRef.current) return;
    try {
      L.polyline(latlngs, { color: "#0ea5e9", weight: 4, opacity: 0.9 }).addTo(layerRef.current);
    } catch { /* ignore */ }
    fit(latlngs);
  }

  if (failed) {
    return (
      <div
        style={{ height }}
        className="w-full rounded-xl border border-white/10 flex items-center justify-center bg-white/[0.02]"
      >
        <p className="text-white/40 text-xs px-4 text-center">Map couldn't load in this browser.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%", borderRadius: 12, overflow: "hidden" }}
      className="border border-white/10"
    />
  );
}
