// ════════════════════════════════════════════════════════════
//  SENT CONFIRMATION — Full-screen "done" view after publishing a
//  request or offer. It waits for a relay to accept the event before
//  it says "sent". If no relay accepts it, it says so (the event is
//  only on this device) instead of claiming success.
//
//  Usage:
//    <SentConfirmation icon="✓" title="Request Published" message="…"
//      accepted={accepted} localOnly={false} onDone={() => setView("my-rides")} />
//  `accepted`: null while sending, then true / false.
// ════════════════════════════════════════════════════════════

import { useEffect } from "react";
import { THEME } from "../theme.js";
import Button from "./Button.jsx";

export default function SentConfirmation({ icon, title, message, accepted, localOnly = false, onDone }) {
  const ok = accepted === true || localOnly;
  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(onDone, 1200);
    return () => clearTimeout(t);
  }, [ok]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: THEME.pageBg }}>
      <div className="text-center max-w-xs" role="status" aria-live="polite">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4 text-4xl" aria-hidden="true">
          {accepted === false && !localOnly ? "⚠️" : icon}
        </div>
        {accepted === null && !localOnly ? (
          <h2 className="text-white text-xl font-bold mb-2">Sending…</h2>
        ) : ok ? (
          <>
            <h2 className="text-white text-xl font-bold mb-2">{title}</h2>
            <p className="text-white/60 text-sm">{localOnly ? "Demo request: kept on this device only." : message}</p>
          </>
        ) : (
          <>
            <h2 className="text-white text-xl font-bold mb-2">Not sent yet</h2>
            <p className="text-white/60 text-sm mb-5">
              No relay accepted it, so it is saved on this device only. Check your connection and the relay list in
              Account, then try again.
            </p>
            <Button onClick={onDone}>Go to Activity</Button>
          </>
        )}
      </div>
    </div>
  );
}
