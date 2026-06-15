// ════════════════════════════════════════════════════════════
//  LOCATION ROW — A small pill showing a pickup or dropoff point.
//  The colored dot is green for pickup, red for dropoff.
//
//  Usage:
//    <LocationRow type="pickup"  label={pickup?.name} />
//    <LocationRow type="dropoff" label={dropoff?.name} />
// ════════════════════════════════════════════════════════════

export default function LocationRow({ type, label, placeholder }) {
  const dotColor = type === "pickup" ? "bg-emerald-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
      <div className={`w-3 h-3 rounded-full ${dotColor}`} />
      <span className="text-white/80 text-sm flex-1">{label || placeholder}</span>
    </div>
  );
}
