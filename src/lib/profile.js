// ════════════════════════════════════════════════════════════
//  PROFILE — Whether a user has the info required to offer rides.
//  Required to drive: a face photo + license plate (state & number)
//  + vehicle year/make/model. Vehicle photo is optional.
// ════════════════════════════════════════════════════════════

export function isDriveReady(user) {
  const v = user?.vehicle || {};
  return !!(user?.picture && v.plateState && v.plateNumber && v.year && v.make && v.model);
}

// Human list of what's still missing (for a helpful gating message).
export function missingDriveInfo(user) {
  const v = user?.vehicle || {};
  const missing = [];
  if (!user?.picture) missing.push("a face photo");
  if (!v.plateState || !v.plateNumber) missing.push("license plate");
  if (!v.year || !v.make || !v.model) missing.push("vehicle year/make/model");
  return missing;
}
