// ════════════════════════════════════════════════════════════
//  BUTTON — One button used everywhere, with style "variants".
//  Change a variant here and every button of that type updates.
//
//  Usage:
//    <Button onClick={fn}>Primary</Button>
//    <Button variant="driver">Offer</Button>
//    <Button variant="ghost">Cancel</Button>
//    <Button disabled>Can't click</Button>
// ════════════════════════════════════════════════════════════

import { THEME } from "../theme.js";

export default function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  className = "",
}) {
  // Background per variant. "ghost" uses a CSS class instead of a gradient.
  const backgrounds = {
    primary: disabled ? "rgba(255,255,255,0.1)" : THEME.brandGradient,
    driver: disabled ? "rgba(255,255,255,0.1)" : THEME.driverGradient,
  };

  const base =
    "w-full py-4 rounded-xl font-semibold text-base transition-all active:scale-95 disabled:cursor-not-allowed";

  if (variant === "ghost") {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`${base} text-rose-400 border border-rose-500/20 bg-rose-500/5 ${className}`}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} text-white ${disabled ? "opacity-30" : ""} ${className}`}
      style={{ background: backgrounds[variant] }}
    >
      {children}
    </button>
  );
}
