// ════════════════════════════════════════════════════════════
//  COLLAPSIBLE — A titled section that starts collapsed. The arrow
//  points left (◀) when collapsed and down (▼) when expanded.
// ════════════════════════════════════════════════════════════

import { useState } from "react";

export default function Collapsible({ title, count, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between text-white/60 text-xs uppercase tracking-widest mb-2"
      >
        <span>
          {title}
          {typeof count === "number" && <span className="text-white/50 ml-1">({count})</span>}
        </span>
        <span aria-hidden="true">{open ? "▼" : "◀"}</span>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}
