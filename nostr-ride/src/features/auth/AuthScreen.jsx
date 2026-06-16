// ════════════════════════════════════════════════════════════
//  AUTH SCREEN — First screen. Two ways to sign in:
//    1. Generate a brand-new Nostr keypair.
//    2. Paste an existing "nsec1..." secret key.
//  Either way it publishes a profile and logs the user in.
// ════════════════════════════════════════════════════════════

import { useState } from "react";
import { generateKeypair, keypairFromNsec } from "../../nostr/keys.js";
import { buildSignedEvent } from "../../nostr/events.js";
import { relay } from "../../nostr/relay.js";
import { EVENT_KINDS } from "../../nostr/eventKinds.js";
import { CONTACT_PLATFORMS } from "../../config/settings.js";
import { useRelays, setRelays } from "../../config/relays.js";
import { THEME } from "../../theme.js";
import Button from "../../ui/Button.jsx";
import RelayEditor from "../../ui/RelayEditor.jsx";

export default function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("new"); // "new" | "import"
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState(CONTACT_PLATFORMS[0]);
  const [handle, setHandle] = useState("");
  const [nsec, setNsec] = useState("");
  const [error, setError] = useState("");
  const [showRelays, setShowRelays] = useState(false); // collapsed by default
  const relays = useRelays();

  // Publish the profile (signed) and finish login with the given keypair.
  const finishLogin = (keys) => {
    const comm = handle ? [{ platform, handle }] : [];
    const displayName = name || "Anonymous Rider";
    relay.publish(
      buildSignedEvent(
        EVENT_KINDS.METADATA,
        { name: displayName, about: "NostrRide user", communication: comm },
        [],
        keys.sk
      )
    );
    onLogin({ ...keys, name: displayName, comm });
  };

  const handleGenerate = () => finishLogin(generateKeypair());

  const handleImport = () => {
    setError("");
    try {
      finishLogin(keypairFromNsec(nsec));
    } catch (e) {
      setError(e.message || "Invalid nsec key.");
    }
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
            <span className="text-2xl">⚡</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight font-display">NostrRide</h1>
          <p className="text-cyan-400/60 text-sm mt-1 tracking-wide">DECENTRALIZED RIDESHARING</p>
        </div>

        {/* Mode switch */}
        <div className="flex gap-2 mb-5 bg-white/5 p-1 rounded-xl border border-white/10">
          <Tab active={mode === "new"} onClick={() => { setMode("new"); setError(""); }}>Create account</Tab>
          <Tab active={mode === "import"} onClick={() => { setMode("import"); setError(""); }}>Login with key</Tab>
        </div>

        <div className="space-y-4">
          {/* Shared profile fields */}
          <Field label="Display Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={onEnter}
              placeholder="Your name or alias"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50"
            />
          </Field>

          <Field label="Contact Method">
            <div className="flex gap-2">
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white focus:outline-none focus:border-cyan-500/50"
              >
                {CONTACT_PLATFORMS.map((p) => (
                  <option key={p} value={p} style={{ color: "#000", background: "#fff" }}>{p}</option>
                ))}
              </select>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                onKeyDown={onEnter}
                placeholder="Handle or number"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
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
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-mono placeholder-white/20 focus:outline-none focus:border-cyan-500/50"
              />
            </Field>
          )}

          {error && <p className="text-rose-400 text-xs">{error}</p>}

          {mode === "new" ? (
            <Button onClick={handleGenerate}>Generate Keys &amp; Enter</Button>
          ) : (
            <Button onClick={handleImport} disabled={!nsec}>Import &amp; Enter</Button>
          )}

          <p className="text-white/20 text-xs text-center leading-relaxed mt-4">
            Keys are real Nostr keys generated/handled locally. Nothing is sent to a server. Your nsec is your password — keep it secret.
          </p>

          {/* Relays — collapsed by default */}
          <div className="border-t border-white/10 pt-3 mt-2">
            <button
              type="button"
              onClick={() => setShowRelays((v) => !v)}
              className="w-full flex items-center justify-between text-white/40 text-xs uppercase tracking-wider"
            >
              <span>Relays ({relays.length})</span>
              <span>{showRelays ? "▼" : "◀"}</span>
            </button>
            {showRelays && (
              <div className="mt-3">
                <RelayEditor relays={relays} onChange={setRelays} />
                <p className="text-white/20 text-[11px] mt-2 leading-relaxed">
                  These are the Nostr relays the app connects to. Changes are saved on this device.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
        active ? "bg-cyan-500/20 text-cyan-400" : "text-white/40"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs text-white/40 uppercase tracking-wider mb-1 block">{label}</label>
      {children}
    </div>
  );
}
