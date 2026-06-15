// ════════════════════════════════════════════════════════════
//  BOTTOM NAV — The tab bar fixed to the bottom of the screen.
//  Each item just switches which screen is showing.
//  Add/remove tabs by editing the `items` array below.
// ════════════════════════════════════════════════════════════

import { useApp } from "../state/AppContext.jsx";
import { THEME } from "../theme.js";

const items = [
  { id: "rider-request", icon: "🚗", label: "Ride" },
  { id: "driver-browse", icon: "🛞", label: "Drive" },
  { id: "my-rides", icon: "📋", label: "Activity" },
  { id: "profile", icon: "👤", label: "Account" },
];

export default function BottomNav() {
  const { view, setView, nearbyRequestCount } = useApp();

  // Only the Drive tab shows a badge (nearby ride requests).
  const badgeFor = (id) => (id === "driver-browse" ? nearbyRequestCount || 0 : 0);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-around py-2 px-1 border-t border-white/10 max-w-md mx-auto"
      style={{ background: THEME.headerBg, backdropFilter: "blur(12px)" }}
    >
      {items.map((item) => {
        const count = badgeFor(item.id);
        const badge = count > 0 ? count : null;
        return (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-all ${
              view === item.id ? "text-cyan-400" : "text-white/30"
            }`}
          >
            <span className="text-lg relative">
              {item.icon}
              {badge && (
                <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {badge}
                </span>
              )}
            </span>
            <span className="text-[10px]">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
