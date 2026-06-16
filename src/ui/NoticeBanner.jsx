// ════════════════════════════════════════════════════════════
//  NOTICE BANNER — Transient banners pinned to the top. Each one auto-
//  dismisses after 3s and can be swiped away (up / left / right).
//  Rendered above everything (very high z-index).
// ════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { useApp } from "../state/AppContext.jsx";

function Banner({ notice, onClose }) {
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const start = useRef(null);
  const closed = useRef(false);

  // Auto-dismiss after 3 seconds.
  useEffect(() => {
    const t = setTimeout(() => onClose(notice.id), 3000);
    return () => clearTimeout(t);
  }, [notice.id, onClose]);

  const finish = () => { if (!closed.current) { closed.current = true; onClose(notice.id); } };

  const onDown = (e) => {
    const p = e.touches ? e.touches[0] : e;
    start.current = { x: p.clientX, y: p.clientY };
  };
  const onMove = (e) => {
    if (!start.current) return;
    const p = e.touches ? e.touches[0] : e;
    setDrag({ x: p.clientX - start.current.x, y: p.clientY - start.current.y });
  };
  const onUp = () => {
    if (!start.current) return;
    const { x, y } = drag;
    // Swipe up, left, or right past threshold dismisses.
    if (y < -40 || Math.abs(x) > 60) finish();
    else setDrag({ x: 0, y: 0 });
    start.current = null;
  };

  return (
    <div
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      onTouchStart={onDown}
      onTouchMove={onMove}
      onTouchEnd={onUp}
      className="pointer-events-auto mx-auto max-w-md w-[92%] rounded-xl border border-white/15 px-4 py-3 shadow-lg flex items-center gap-3 select-none"
      style={{
        background: "linear-gradient(135deg, rgba(6,182,212,0.95), rgba(16,185,129,0.92))",
        color: "#04211c",
        transform: `translate(${drag.x}px, ${Math.min(0, drag.y)}px)`,
        transition: start.current ? "none" : "transform 0.15s ease",
        cursor: "grab",
      }}
    >
      <span className="text-sm font-medium flex-1">{notice.message}</span>
      <button onClick={finish} className="text-[#04211c]/70 text-lg leading-none px-1">×</button>
    </div>
  );
}

export default function NoticeBanner() {
  const { notices, dismissNotice } = useApp();
  if (!notices || notices.length === 0) return null;
  return (
    <div className="fixed top-3 inset-x-0 z-[10050] flex flex-col gap-2 pointer-events-none">
      {notices.map((n) => (
        <Banner key={n.id} notice={n} onClose={dismissNotice} />
      ))}
    </div>
  );
}
