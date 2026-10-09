// ════════════════════════════════════════════════════════════
//  AUTH SCREEN — First screen. Ways to sign in:
//    1. Generate a brand-new Nostr keypair (then a key-backup step).
//    2. Paste an existing "nsec1..." secret key.
//    3. Unlock a key saved on this device (password, NIP-49).
//  "Remember me" saves the key encrypted with a password, so a reload
//  doesn't log the user out (nostr/keystore.js).
//  A new key publishes a fresh profile. An existing key keeps its
//  Nostr profile (we never overwrite it with a blank one).
// ════════════════════════════════════════════════════════════

import { useState } from "react";
import { generateKeypair, keypairFromNsec, keypairFromSecretKey } from "../../nostr/keys.js";
import { buildSignedEvent } from "../../nostr/events.js";
import { relay } from "../../nostr/relay.js";
import { EVENT_KINDS } from "../../nostr/eventKinds.js";
import { getMetadata, getProfile } from "../../nostr/profiles.js";
import { getSavedKey, saveKey, unlockKey, MIN_PASSWORD } from "../../nostr/keystore.js";
import { myVehicle } from "../../lib/privacy.js";
import { useRelays, setRelays } from "../../config/relays.js";
import { THEME } from "../../theme.js";
import Button from "../../ui/Button.jsx";
import RelayEditor from "../../ui/RelayEditor.jsx";
import { UnlockView, BackupStep } from "./AuthSteps.jsx";

const inputCls =
  "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:border-cyan-500/50";

// Let React paint a "busy" label before slow, blocking work (scrypt).
const nextFrame = () => new Promise((r) => setTimeout(r, 30));

export default function AuthScreen({ onLogin }) {
  const [saved] = useState(getSavedKey);
  const [stage, setStage] = useState(saved ? "unlock" : "form"); // "unlock" | "form" | "backup"
  const [mode, setMode] = useState("new"); // "new" | "import"
  const [name, setName] = useState("");
  const [nsec, setNsec] = useState("");
  const [remember, setRemember] = useState(true);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(null); // new keys waiting for the backup step
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showRelays, setShowRelays] = useState(false); // collapsed by default
  const relays = useRelays();

  // Enter the app; save the key (encrypted) first if asked to.
  const enter = async (u, { save = remember } = {}) => {
    if (save) {
      setBusy(true);
      await nextFrame();
      saveKey(u.sk, password, { name: u.name });
      setBusy(false);
    }
    onLogin(u);
  };

  // A brand-new key: publish its first profile.
  const enterNew = (keys) => {
    const displayName = name.trim() || "Anonymous Rider";
    relay.publish(
      buildSignedEvent(EVENT_KINDS.METADATA, { name: displayName, about: "NostrRide user", communication: [] }, [], keys.sk)
    );
    enter({ ...keys, name: displayName, comm: [] });
  };

  // An existing key. Kind 0 is shared by every Nostr app: publishing a
  // fresh one would wipe the user's real name, photo, and other fields on
  // every relay. So load what exists and keep it; only write when the user
  // typed a new name (merged into the old profile).
  const enterExisting = async (keys, { save } = {}) => {
    setBusy(true);
    await relay.fetchProfile(keys.publicKey);
    setBusy(false);
    const existing = getMetadata(keys.publicKey);
    const typed = name.trim();
    if (!existing) {
      if (typed) return enterNew(keys);
      return enter({ ...keys, name: saved?.name || "Anonymous Rider", comm: [] }, { save });
    }
    const p = getProfile(keys.publicKey);
    if (typed && typed !== p.name) {
      relay.publish(buildSignedEvent(EVENT_KINDS.METADATA, { ...existing, name: typed }, [], keys.sk));
    }
    enter(
      { ...keys, name: typed || p.name || "Anonymous Rider", comm: p.comm, picture: p.picture, lud16: p.lud16, vehicle: myVehicle(keys.publicKey, keys.sk) },
      { save }
    );
  };

  const passwordOk = () => {
    if (remember && password.length < MIN_PASSWORD) {
      setError(`Use a password of at least ${MIN_PASSWORD} characters, or turn off "Remember me".`);
      return false;
    }
    return true;
  };

  const handleGenerate = () => {
    setError("");
    if (!passwordOk()) return;
    setPending(generateKeypair());
    setStage("backup");
  };

  const handleImport = () => {
    if (busy) return;
    setError("");
    if (!passwordOk()) return;
    let keys;
    try {
      keys = keypairFromNsec(nsec);
    } catch (e) {
      setError(e.message || "Invalid nsec key.");
      return;
    }
    enterExisting(keys);
  };

  const handleUnlock = async (pw) => {
    setError("");
    setBusy(true);
    await nextFrame();
    let keys;
    try {
      keys = keypairFromSecretKey(unlockKey(pw));
    } catch (e) {
      setBusy(false);
      setError(e.message);
      return;
    }
    enterExisting(keys, { save: false }); // already saved
  };

  // Pressing Enter in a field triggers the screen's primary action.
  const submit = () => {
    if (mode === "new") handleGenerate();
    else if (nsec) handleImport();
  };
  const onEnter = (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "linear-gradient(180deg, #030712 0%, #0c1929 50%, #030712 100%)" }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: THEME.brandGradient }}
          >
            <span className="text-2xl" aria-hidden="true">⚡</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight font-display">NostrRide</h1>
          <p className="text-cyan-400/70 text-sm mt-1 tracking-wide">DECENTRALIZED RIDESHARING</p>
        </div>

        {stage === "unlock" && (
          <UnlockView
            saved={saved}
            busy={busy}
            error={error}
            onUnlock={handleUnlock}
            onSwitch={() => { setStage("form"); setError(""); }}
          />
        )}

        {stage === "backup" && pending && (
          <BackupStep nsec={pending.nsec} onContinue={() => enterNew(pending)} />
        )}

        {stage === "form" && (
          <>
            {/* Mode switch */}
            <div className="flex gap-2 mb-5 bg-white/5 p-1 rounded-xl border border-white/10">
              <Tab active={mode === "new"} onClick={() => { setMode("new"); setError(""); }}>Create account</Tab>
              <Tab active={mode === "import"} onClick={() => { setMode("import"); setError(""); }}>Login with key</Tab>
            </div>

            <div className="space-y-4">
              {/* Shared profile fields */}
              <Field label="Display Name">
                <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onEnter} placeholder="Your name or alias" className={inputCls} />
              </Field>

              {/* Import-only field */}
              {mode === "import" && (
                <Field label="Secret Key (nsec)">
                  <input
                    value={nsec}
                    onChange={(e) => setNsec(e.target.value)}
                    onKeyDown={onEnter}
                    placeholder="nsec1..."
                    spellCheck={false}
                    autoComplete="off"
                    className={`${inputCls} text-xs font-mono`}
                  />
                </Field>
              )}

              {/* Remember me: key saved encrypted with this password */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-white/70 text-sm cursor-pointer">
                  <input type="checkbox" checked={remember} onChange={(e) => { setRemember(e.target.checked); setError(""); }} />
                  Remember me on this device
                </label>
                {remember && (
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    onKeyDown={onEnter}
                    placeholder={`Password to unlock (${MIN_PASSWORD}+ characters)`}
                    autoComplete="new-password"
                    aria-label="Password"
                    className={inputCls}
                  />
                )}
              </div>

              {error && <p className="text-rose-400 text-xs">{error}</p>}

              {mode === "new" ? (
                <Button onClick={handleGenerate} disabled={busy}>Generate Keys &amp; Enter</Button>
              ) : (
                <Button onClick={handleImport} disabled={!nsec || busy}>{busy ? "Loading your profile…" : "Import & Enter"}</Button>
              )}

              <p className="text-white/50 text-xs text-center leading-relaxed mt-4">
                Keys are real Nostr keys made on this device. Nothing is sent to a server. "Remember me" saves your key
                here only, encrypted with your password.
              </p>

              {/* Relays — collapsed by default */}
              <div className="border-t border-white/10 pt-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowRelays((v) => !v)}
                  aria-expanded={showRelays}
                  className="w-full flex items-center justify-between text-white/50 text-xs uppercase tracking-wider"
                >
                  <span>Relays ({relays.length})</span>
                  <span aria-hidden="true">{showRelays ? "▼" : "◀"}</span>
                </button>
                {showRelays && (
                  <div className="mt-3">
                    <RelayEditor relays={relays} onChange={setRelays} />
                    <p className="text-white/50 text-[11px] mt-2 leading-relaxed">
                      These are the Nostr relays the app connects to. Changes are saved on this device.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
        active ? "bg-cyan-500/20 text-cyan-400" : "text-white/50"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs text-white/50 uppercase tracking-wider mb-1 block">{label}</span>
      {children}
    </label>
  );
}
