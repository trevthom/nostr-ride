// ════════════════════════════════════════════════════════════
//  THEME — Colors and gradients used across the app.
//  Change a value here and it updates everywhere that uses it.
// ════════════════════════════════════════════════════════════

export const THEME = {
  // The dark page background behind every screen.
  pageBg: "#030712",

  // Frosted-glass header background (semi-transparent dark).
  headerBg: "rgba(3,7,18,0.9)",

  // The main brand gradient (used on primary buttons + the logo).
  brandGradient: "linear-gradient(135deg, #0ea5e9, #06b6d4)",

  // The "driver" accent gradient (used on offer buttons).
  driverGradient: "linear-gradient(135deg, #f59e0b, #d97706)",

  // The look of the map background.
  mapGradient: "linear-gradient(135deg, #0a1628 0%, #0f2035 50%, #0a1628 100%)",

  // A faint background used inside cards.
  cardBg: "rgba(255,255,255,0.02)",
};

// Semantic accent colors used as Tailwind classes elsewhere:
//   emerald  -> pickup locations
//   rose     -> dropoff locations
//   amber    -> driver / offers
//   cyan     -> primary actions / rider
