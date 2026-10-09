// ════════════════════════════════════════════════════════════
//  AUTH STEPS — Two small steps used by AuthScreen:
//    • UnlockView — a key saved on this device: enter the password.
//    • BackupStep — after "Create account": show the new secret key
//      and make the user confirm they saved it (it can't be reset).
// ════════════════════════════════════════════════════════════

import { useState } from "react";
import { shortNpub } from "../../nostr/keys.js";
import Button from "../../ui/Button.jsx";

const inputCls =
  "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-cyan-500/50";

export function UnlockView({ saved, busy, error, onUnlock, onSwitch }) {
  const [password, setPassword] = useState("");
  return (
    <div className="space-y-4">
      <p className="text-white/70 text-sm text-center">
        Welcome back{saved.name ? `, ${saved.name}` : ""}.
        <span className="block text-white/50 text-xs font-mono mt-1">{shortNpub(saved.pubkey)}</span>
      </p>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && password) onUnlock(password); }}
        placeholder="Password"
        autoFocus
        aria-label="Password"
        className={inputCls}
      />
      {error && <p className="text-rose-400 text-xs">{error}</p>}
      <Button onClick={() => onUnlock(password)} disabled={!password || busy}>{busy ? "Unlocking…" : "Unlock"}</Button>
      <button onClick={onSwitch} className="w-full text-white/50 text-sm py-2">Use a different account</button>
    </div>
  );
}

export function BackupStep({ nsec, onContinue }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(nsec);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="space-y-4">
      <h2 className="text-white text-lg font-bold text-center">Save your secret key</h2>
      <p className="text-white/60 text-sm leading-relaxed">
        This key is your account. If you lose it, you lose the account and its ratings. No one can reset it.
        Keep it in a password manager. Never share it.
      </p>
      <p className="text-white/80 text-xs font-mono break-all bg-black/30 border border-white/10 rounded-xl p-3">{nsec}</p>
      <button onClick={copy} className="text-cyan-400 text-sm">{copied ? "Copied!" : "Copy key"}</button>
      <label className="flex items-start gap-2 text-white/70 text-sm cursor-pointer">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-1" />
        I saved my secret key in a safe place.
      </label>
      <Button onClick={onContinue} disabled={!saved}>Continue</Button>
    </div>
  );
}
