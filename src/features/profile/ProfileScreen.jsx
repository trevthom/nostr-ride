// ════════════════════════════════════════════════════════════
//  ACCOUNT — Identity header (real npub), rating + completed-trip
//  count, the Lightning wallet (NWC), driver notification settings,
//  the editable+saved relay list, and the user's keys.
// ════════════════════════════════════════════════════════════

import { useState, useRef } from "react";
import { useApp } from "../../state/AppContext.jsx";
import { relay } from "../../nostr/relay.js";
import { EVENT_KINDS } from "../../nostr/eventKinds.js";
import { buildSignedEvent } from "../../nostr/events.js";
import { getMetadata } from "../../nostr/profiles.js";
import { sealVehicle } from "../../lib/privacy.js";
import { reputation } from "../../lib/rides.js";
import { isDriveReady } from "../../lib/profile.js";
import { resizeImage } from "../../lib/image.js";
import { useRelays, setRelays } from "../../config/relays.js";
import { CONTACT_PLATFORMS } from "../../config/settings.js";
import Screen from "../../ui/Screen.jsx";
import RelayEditor from "../../ui/RelayEditor.jsx";
import WalletSection from "./WalletSection.jsx";
import KeysSection from "./KeysSection.jsx";
import LightningAddressSection from "./LightningAddressSection.jsx";
import VehicleSection from "./VehicleSection.jsx";

const OPT = { color: "#fff", background: "#0b1220" }; // legible dropdown options

export default function ProfileScreen() {
  const { user, setUser, logout, notifyNearby, setNotifyNearby, notifyRadius, setNotifyRadius } = useApp();
  const relays = useRelays();
  const [nameDraft, setNameDraft] = useState(user.name);
  const [editingName, setEditingName] = useState(false);
  const [lightbox, setLightbox] = useState("");
  const faceInputRef = useRef(null);
  const rep = reputation(user.publicKey);

  const comm = user.comm || [];
  const [draftPlatform, setDraftPlatform] = useState(CONTACT_PLATFORMS[0]);
  const [draftHandle, setDraftHandle] = useState("");

  const [imgErr, setImgErr] = useState("");

  // Merge a patch into the user and republish the full profile (kind 0)
  // so other users see the latest name/photo/vehicle. Kind 0 is shared
  // with every Nostr app, so start from the newest one we have and keep
  // fields we don't manage (about, lud16, nip05, banner…).
  const saveProfile = (patch) => {
    const next = { ...user, ...patch };
    setUser(next);
    const base = getMetadata(next.publicKey) || {};
    relay.publish(
      buildSignedEvent(
        EVENT_KINDS.METADATA,
        {
          ...base,
          name: next.name,
          about: base.about ?? "NostrRide user",
          communication: next.comm || [],
          picture: next.picture || "",
          ...(next.lud16 !== undefined && { lud16: next.lud16 }),
          // Plate is sealed to ourselves; riders get it privately in offers.
          vehicle: sealVehicle(next.vehicle, next.sk, next.publicKey),
        },
        [],
        next.sk
      )
    );
    return next;
  };

  const saveName = () => {
    saveProfile({ name: nameDraft.trim() || "Anonymous Rider" });
    setEditingName(false);
  };

  const addContact = () => {
    if (!draftHandle.trim()) return;
    saveProfile({ comm: [...comm, { platform: draftPlatform, handle: draftHandle.trim() }] });
    setDraftHandle("");
  };
  const removeContact = (i) => saveProfile({ comm: comm.filter((_, idx) => idx !== i) });

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

  // Removing the face photo revokes driving until it's re-added
  // (isDriveReady recomputes from the saved profile).
  const removeFace = () => saveProfile({ picture: "" });

  return (
    <Screen title="Account">
      <div className="space-y-5">
        {/* Identity header */}
        <div className="text-center py-2">
          <div className="relative inline-block">
            <input ref={faceInputRef} type="file" accept="image/*" onChange={onFacePick} className="hidden" />
            {user.picture ? (
              <img
                src={user.picture}
                alt="You"
                onClick={() => setLightbox(user.picture)}
                className="w-20 h-20 rounded-full object-cover mx-auto border border-white/10 cursor-zoom-in"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mx-auto text-white text-2xl font-bold">
                {user.name[0]}
              </div>
            )}
            {!user.picture && (
              <span className="absolute -bottom-1 -right-1 text-[10px] bg-amber-500/90 text-black px-1.5 py-0.5 rounded-full font-semibold">
                Required
              </span>
            )}
          </div>
          <div className="flex items-center justify-center gap-3 mt-1">
            <button onClick={() => faceInputRef.current?.click()} className="text-cyan-400 text-[11px]">
              {user.picture ? "Change photo" : "Add photo"}
            </button>
            {user.picture && <button onClick={removeFace} className="text-rose-400/80 text-[11px]">Remove</button>}
          </div>
          <p className="text-white/30 text-[11px] mb-2">📷 A face photo is required to drive</p>

          {/* Name with pencil edit */}
          {editingName ? (
            <div className="flex gap-2 justify-center items-center mt-1">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveName(); } if (e.key === "Escape") setEditingName(false); }}
                autoFocus
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-cyan-500/50"
              />
              <button onClick={saveName} className="text-cyan-400 text-sm font-medium">Save</button>
              <button onClick={() => { setNameDraft(user.name); setEditingName(false); }} className="text-white/40 text-sm">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <h3 className="text-white font-bold text-lg">{user.name}</h3>
              <button onClick={() => { setNameDraft(user.name); setEditingName(true); }} aria-label="Edit name" className="text-white/40 hover:text-cyan-400 text-sm">✏️</button>
            </div>
          )}

          <div className="flex justify-center gap-8 mt-3">
            <div className="text-center">
              <p className="text-white/40 text-[11px] uppercase tracking-wider">As Rider</p>
              <p className="text-white/80 text-sm mt-0.5">{rep.rides} Rides · {rep.riderReviews.count} Reviews</p>
              {rep.riderReviews.avg != null && <p className="text-amber-400 text-xs">★ {rep.riderReviews.avg.toFixed(1)}</p>}
            </div>
            <div className="text-center">
              <p className="text-white/40 text-[11px] uppercase tracking-wider">As Driver</p>
              <p className="text-white/80 text-sm mt-0.5">{rep.drives} Drives · {rep.driverReviews.count} Reviews</p>
              {rep.driverReviews.avg != null && <p className="text-amber-400 text-xs">★ {rep.driverReviews.avg.toFixed(1)}</p>}
            </div>
          </div>
          {imgErr && <p className="text-rose-400 text-xs mt-2">{imgErr}</p>}
        </div>

        {/* Vehicle & license — required to use the Drive tab */}
        <VehicleSection vehicle={user.vehicle} ready={isDriveReady(user)} onSave={(vehicle) => saveProfile({ vehicle })} />

        {/* Lightning address — where riders pay this user (required to drive) */}
        <LightningAddressSection value={user.lud16 || ""} onSave={(lud16) => saveProfile({ lud16 })} />

        {/* Contact methods — add as many as you like */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-3">
          <p className="text-white/40 text-xs uppercase tracking-wider">Contact Methods</p>
          {comm.length > 0 && (
            <div className="space-y-2">
              {comm.map((c, i) => (
                <div key={i} className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2">
                  <p className="text-white/70 text-sm">{c.platform}: {c.handle}</p>
                  <button onClick={() => removeContact(i)} className="text-rose-400/80 text-xs">Remove</button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <select
              value={draftPlatform}
              onChange={(e) => setDraftPlatform(e.target.value)}
              className="min-w-0 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
              style={{ backgroundColor: "#0b1220", color: "#fff" }}
            >
              {CONTACT_PLATFORMS.map((p) => <option key={p} value={p} style={OPT}>{p}</option>)}
            </select>
            <input
              value={draftHandle}
              onChange={(e) => setDraftHandle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addContact(); } }}
              placeholder="Handle or number"
              className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-cyan-500/50"
            />
            <button
              onClick={addContact}
              disabled={!draftHandle.trim()}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>

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
        <p className="text-white/50 text-[11px] text-center -mt-3">
          Logging out also removes your saved key from this device. Make sure you have a copy of your nsec.
        </p>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.92)", zIndex: 10060 }}
          onClick={() => setLightbox("")}
        >
          <img src={lightbox} alt="Photo" className="max-w-[92vw] max-h-[85vh] object-contain rounded-lg" />
        </div>
      )}
    </Screen>
  );
}
