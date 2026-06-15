// ════════════════════════════════════════════════════════════
//  APP SETTINGS — Start here to change how the app behaves.
//  Everything in this file is safe to edit.
// ════════════════════════════════════════════════════════════

// How close (in miles) a ride's pickup AND dropoff must be to a
// driver's saved route before the driver gets a "match" notification.
export const MATCH_RADIUS_MILES = 1;

// Default radius for the driver "notify me of nearby ride requests" feature.
export const DEFAULT_NOTIFY_RADIUS_MILES = 10;

// The list of Nostr relays now lives in src/config/relays.js (it is
// editable in-app and saved to the browser). Import DEFAULT_RELAYS or
// getRelays() from there.

// When true, the app pre-loads a few fake riders, requests, and a
// driver route so you can see the full flow immediately.
// Set to false for a clean, empty app.
export const USE_DEMO_DATA = true;

// Contact platforms users can pick from in their profile.
export const CONTACT_PLATFORMS = ["Signal", "Telegram", "Phone", "WhatsApp"];
