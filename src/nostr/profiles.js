// ════════════════════════════════════════════════════════════
//  PROFILES — Look up a user's name, contacts, photo, Lightning
//  address, and vehicle by public key.
//  Reads the most recent Kind 0 (metadata) event for that user.
// ════════════════════════════════════════════════════════════

import { relay } from "./relay.js";
import { EVENT_KINDS } from "./eventKinds.js";
import { normalizeRates } from "../lib/fare.js";
    stats: statsOf(meta), // self-reported totals (miles driven), or null
    gender: meta.gender === "male" || meta.gender === "female" ? meta.gender : "", // optional, self-declared
    vehicle: v && {
      picture: str(v.picture),
      plateState: str(v.plateState),
      plateNumber: str(v.plateNumber),
      year: str(v.year),
      make: str(v.make),
      model: str(v.model),
    },
  };
}
