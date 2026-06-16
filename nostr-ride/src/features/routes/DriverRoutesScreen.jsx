// ════════════════════════════════════════════════════════════
//  DRIVER ROUTES — Create recurring routes by adding waypoints via
//  address search. Saved as Kind 30083 events. New ride requests
//  near a route trigger a "match" notification for that driver.
// ════════════════════════════════════════════════════════════

import { useState } from "react";
import { useApp } from "../../state/AppContext.jsx";
import { relay } from "../../nostr/relay.js";
import { EVENT_KINDS } from "../../nostr/eventKinds.js";
import { MATCH_RADIUS_MILES } from "../../config/settings.js";
import Screen from "../../ui/Screen.jsx";
import Button from "../../ui/Button.jsx";
import MapView from "../../ui/MapView.jsx";
import AddressInput from "../../ui/AddressInput.jsx";

export default function DriverRoutesScreen() {
  const { user, publish, refreshData, liveTick } = useApp();
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("");
  const [waypoints, setWaypoints] = useState([]);

  void liveTick; // re-read routes when relay events arrive
  const myRoutes = relay.query({ kinds: [EVENT_KINDS.DRIVER_ROUTE], authors: [user.publicKey] });

  const handleSave = () => {
    if (waypoints.length < 2 || !name) return;
    publish(
      EVENT_KINDS.DRIVER_ROUTE,
      { name, waypoints, schedule: schedule || "flexible", radiusMiles: MATCH_RADIUS_MILES },
      [["d", "route-" + Date.now()], ["t", "driver-route"]]
    );
    setName("");
    setSchedule("");
    setWaypoints([]);
    refreshData();
  };

  return (
    <Screen title="My Routes">
      <div className="space-y-5">
        <div>
          <p className="text-white/30 text-xs uppercase tracking-widest mb-2">Add New Route</p>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Route name"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50 text-sm mb-3"
          />
          <input
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            placeholder="Schedule (e.g. weekdays 8am-9am)"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50 text-sm mb-3"
          />

          <div className="mb-3">
            <AddressInput
              label="Add waypoint"
              value={null}
              onSelect={(loc) => loc && setWaypoints((w) => [...w, loc])}
              dotColor="bg-amber-500"
              placeholder="Search an address to add a stop"
            />
          </div>

          {waypoints.length > 0 && (
            <div className="bg-white/5 rounded-xl p-3 border border-white/10 mb-3">
              <p className="text-white/30 text-xs mb-1">Waypoints ({waypoints.length}):</p>
              {waypoints.map((w, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-white/60 py-0.5">
                  <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px]">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate">{w.name}</span>
                  <button
                    onClick={() => setWaypoints(waypoints.filter((_, j) => j !== i))}
                    className="text-rose-400/60 text-xs shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {waypoints.length >= 2 && <MapView waypoints={waypoints} />}

          <div className="mt-3">
            <Button variant="driver" onClick={handleSave} disabled={waypoints.length < 2 || !name}>
              Save Route
            </Button>
          </div>
        </div>

        {myRoutes.length > 0 && (
          <div>
            <p className="text-white/30 text-xs uppercase tracking-widest mb-2">Saved Routes</p>
            {myRoutes.map((r) => {
              const c = JSON.parse(r.content);
              return (
                <div key={r.id} className="rounded-xl border border-white/10 p-4 mb-2 bg-white/[0.02]">
                  <p className="text-white font-medium text-sm">{c.name}</p>
                  <p className="text-white/30 text-xs">{c.waypoints.length} waypoints · {c.schedule}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Screen>
  );
}
