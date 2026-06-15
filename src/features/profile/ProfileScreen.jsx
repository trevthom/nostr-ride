// ════════════════════════════════════════════════════════════
//  ACCOUNT — Identity header (real npub), rating + completed-trip
//  count, the Lightning wallet (NWC), driver notification settings,
//  the editable+saved relay list, and the user's keys.
// ════════════════════════════════════════════════════════════

import { useState } from "react";
import { useApp } from "../../state/AppContext.jsx";
import { relay } from "../../nostr/relay.js";
import { EVENT_KINDS } from "../../nostr/eventKinds.js";
import { buildSignedEvent } from "../../nostr/events.js";
import { reputation } from "../../lib/rides.js";
import { isDriveReady } from "../../lib/profile.js";
import { resizeImage } from "../../lib/image.js";
import { useRelays, setRelays } from "../../config/relays.js";
import Screen from "../../ui/Screen.jsx";
import RelayEditor from "../../ui/RelayEditor.jsx";
import WalletSection from "./WalletSection.jsx";
import KeysSection from "./KeysSection.jsx";

export default function ProfileScreen() {
  const { user, setUser, logout, notifyNearby, setNotifyNearby, notifyRadius, setNotifyRadius } = useApp();
  const relays = useRelays();
  const [nameDraft, setNameDraft] = useState(user.name);
  const [savedName, setSavedName] = useState(false);
  const rep = reputation(user.publicKey);

  const v = user.vehicle || {};
  const [veh, setVeh] = useState({
    picture: v.picture || "",
    plateState: v.plateState || "",
    plateNumber: v.plateNumber || "",
    year: v.year || "",
    make: v.make || "",
    model: v.model || "",
  });
  const [savedVeh, setSavedVeh] = useState(false);
  const [imgErr, setImgErr] = useState("");

  // Merge a patch into the user and republish the full profile (kind 0)
  // so other users see the latest name/photo/vehicle.
  const saveProfile = (patch) => {
    const next = { ...user, ...patch };
    setUser(next);
    relay.publish(
      buildSignedEvent(
        EVENT_KINDS.METADATA,
        {
          name: next.name,
          about: "NostrRide user",
          communication: next.comm || [],
          picture: next.picture || "",
          vehicle: next.vehicle || {},
        },
        [],
        next.sk
      )
    );
    return next;
  };

  const saveName = () => {
    saveProfile({ name: nameDraft.trim() || "Anonymous Rider" });
    setSavedName(true);
    setTimeout(() => setSavedName(false), 1500);
  };

  // Face photo (required) — resized small so it fits in profile metadata.
  const onFacePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgErr("");
    try {
      const dataUrl = await resizeImage(file, 220, 0.6);
      saveProfile({ picture: dataUrl });
    } catch {
      setImgErr("Couldn't process that image.");
    }
  };

  // Vehicle photo (optional).
  const onVehiclePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgErr("");
    try {
      const dataUrl = await resizeImage(file, 300, 0.55);
      setVeh((s) => ({ ...s, picture: dataUrl }));
    } catch {
      setImgErr("Couldn't process that image.");
    }
  };

  const saveVehicle = () => {
    saveProfile({ vehicle: { ...veh } });
    setSavedVeh(true);
    setTimeout(() => setSavedVeh(false), 1500);
  };

  const driveReady = isDriveReady({ ...user, vehicle: veh });

  return (
    <Screen title="Account">
      <div className="space-y-5">
        {/* Identity header */}
        <div className="text-center py-2">
          <label className="cursor-pointer inline-block relative">
            <input type="file" accept="image/*" onChange={onFacePick} className="hidden" />
            {user.picture ? (
              <img src={user.picture} alt="You" className="w-20 h-20 rounded-full object-cover mx-auto mb-1 border border-white/10" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mx-auto mb-1 text-white text-2xl font-bold">
                {user.name[0]}
              </div>
            )}
            <span className="block text-cyan-400 text-[11px] mb-2">{user.picture ? "Change photo" : "Add photo"}</span>
          </label>
          <h3 className="text-white font-bold text-lg">{user.name}</h3>
          <div className="flex justify-center gap-8 mt-3">
            <div className="text-center">
              <p className="text-white/40 text-[11px] uppercase tracking-wider">As Rider</p>
              <p className="text-white/80 text-sm mt-0.5">
                {rep.rides} Rides · {rep.riderReviews.count} Reviews
              </p>
              {rep.riderReviews.avg != null && (
                <p className="text-amber-400 text-xs">★ {rep.riderReviews.avg.toFixed(1)}</p>
              )}
            </div>
            <div className="text-center">
              <p className="text-white/40 text-[11px] uppercase tracking-wider">As Driver</p>
              <p className="text-white/80 text-sm mt-0.5">
                {rep.drives} Drives · {rep.driverReviews.count} Reviews
              </p>
              {rep.driverReviews.avg != null && (
                <p className="text-amber-400 text-xs">★ {rep.driverReviews.avg.toFixed(1)}</p>
              )}
            </div>
          </div>
        </div>

        {/* Display name */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Display Name</p>
          <div className="flex gap-2">
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveName(); } }}
              placeholder="Your name"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
            />
            <button
              onClick={saveName}
              disabled={nameDraft.trim() === user.name}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 disabled:opacity-40"
            >
              {savedName ? "Saved" : "Save"}
            </button>
          </div>
          {imgErr && <p className="text-rose-400 text-xs mt-2">{imgErr}</p>}
        </div>

        {/* Vehicle & license — required to use the Drive tab */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-white/40 text-xs uppercase tracking-wider">Vehicle &amp; License</p>
            <span className={`text-[11px] px-2 py-0.5 rounded-full ${driveReady ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
              {driveReady ? "Ready to drive" : "Required to drive"}
            </span>
          </div>

          <label className="cursor-pointer block">
            <input type="file" accept="image/*" onChange={onVehiclePick} className="hidden" />
            {veh.picture ? (
              <img src={veh.picture} alt="Vehicle" className="w-full h-32 object-cover rounded-lg border border-white/10" />
            ) : (
              <div className="w-full h-20 rounded-lg border border-dashed border-white/15 flex items-center justify-center text-white/40 text-sm">
                + Add vehicle photo (optional)
              </div>
            )}
          </label>

          <div className="flex gap-2">
            <input
              value={veh.plateState}
              onChange={(e) => setVeh((s) => ({ ...s, plateState: e.target.value.toUpperCase().slice(0, 3) }))}
              placeholder="State"
              className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
            />
            <input
              value={veh.plateNumber}
              onChange={(e) => setVeh((s) => ({ ...s, plateNumber: e.target.value.toUpperCase() }))}
              placeholder="Plate number"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div className="flex gap-2">
            <input
              value={veh.year}
              onChange={(e) => setVeh((s) => ({ ...s, year: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
              placeholder="Year"
              className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
            />
            <input
              value={veh.make}
              onChange={(e) => setVeh((s) => ({ ...s, make: e.target.value }))}
              placeholder="Make"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
            />
            <input
              value={veh.model}
              onChange={(e) => setVeh((s) => ({ ...s, model: e.target.value }))}
              placeholder="Model"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <button
            onClick={saveVehicle}
            className="w-full py-2.5 rounded-lg text-sm font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30"
          >
            {savedVeh ? "Saved" : "Save vehicle info"}
          </button>
          <p className="text-white/30 text-[11px]">
            Your face photo and these details are shared with other users so riders know who's picking them up.
          </p>
        </div>
        {user.comm?.length > 0 && (
          <div className="bg-white/5 rounded-xl border border-white/10 p-4">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Contact Methods</p>
            {user.comm.map((c, i) => (
              <p key={i} className="text-white/70 text-sm">{c.platform}: {c.handle}</p>
            ))}
          </div>
        )}

        {/* Lightning wallet (Nostr Wallet Connect) */}
        <WalletSection />

        {/* Driver notifications */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 pr-3">
              <p className="text-white/80 text-sm font-medium">Notify me of nearby ride requests</p>
              <p className="text-white/40 text-xs mt-0.5">
                Shows a badge on the Drive tab when a request is placed near you.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNotifyNearby(!notifyNearby)}
              aria-pressed={notifyNearby}
              style={{
                flexShrink: 0,
                padding: "8px 14px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                color: notifyNearby ? "#022c22" : "#ffffff",
                background: notifyNearby ? "#34d399" : "rgba(255,255,255,0.12)",
              }}
            >
              {notifyNearby ? "On" : "Off"}
            </button>
          </div>
          {notifyNearby && (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-white/50 text-xs">Within</span>
              <input
                type="number"
                min="1"
                value={notifyRadius}
                onChange={(e) => setNotifyRadius(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
              />
              <span className="text-white/50 text-xs">miles of my location</span>
            </div>
          )}
        </div>

        {/* Relay list (saved to this browser) */}
        <div>
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Nostr Relays</p>
          <RelayEditor relays={relays} onChange={setRelays} />
        </div>

        {/* Keys (npub + hidden nsec) */}
        <KeysSection user={user} />

        <button
          onClick={logout}
          className="w-full py-3 rounded-xl text-sm font-medium text-rose-400 border border-rose-500/20 bg-rose-500/5"
        >
          Log out
        </button>
      </div>
    </Screen>
  );
}
