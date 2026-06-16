// ════════════════════════════════════════════════════════════
//  SCREEN — The shared page layout: dark background, a sticky
//  header with an optional "← Back" button and title, then the
//  page content. Wrap each screen in this for a consistent look.
//
//  Usage:
//    <Screen title="My Activity" onBack={() => setView("my-rides")}>
//      ...page content...
//    </Screen>
// ════════════════════════════════════════════════════════════

import { THEME } from "../theme.js";

export default function Screen({ title, onBack, right, children }) {
  return (
    <div className="min-h-screen pb-24" style={{ background: THEME.pageBg }}>
      {title && (
        <div
          className="sticky top-0 z-10 px-5 py-4 flex items-center gap-3"
          style={{ background: THEME.headerBg, backdropFilter: "blur(12px)" }}
        >
          {onBack && (
            <button onClick={onBack} className="text-white/60 text-sm">
              ← Back
            </button>
          )}
          <h2 className="text-white font-bold text-lg font-display">{title}</h2>
          {right && <div className="ml-auto">{right}</div>}
        </div>
      )}
      <div className="px-5">{children}</div>
    </div>
  );
}
