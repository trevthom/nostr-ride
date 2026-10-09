// ════════════════════════════════════════════════════════════
//  HOME (driver) — Picks the right screen for where the driver is:
//    not set up yet      → Onboarding (checklist)
//    a drive is under way → DriveTrip (pickup → trip → complete)
//    a drive just ended  → DriveSummary (rate the rider)
//    otherwise           → OnlineHome (GO, requests, waiting)
// ════════════════════════════════════════════════════════════

import { useDriver } from "../state/DriverContext.jsx";
import Onboarding from "./Onboarding.jsx";
import OnlineHome from "./OnlineHome.jsx";
import DriveTrip from "./DriveTrip.jsx";
import DriveSummary from "./DriveSummary.jsx";

export default function HomeScreen() {
  const { driveReady, activeDrive, receipt } = useDriver();
  if (activeDrive) return <DriveTrip key={activeDrive.pubkey + (activeDrive.tags.find((t) => t[0] === "d") || [])[1]} request={activeDrive} />;
  if (receipt) return <DriveSummary key={receipt.id} request={receipt} />;
  if (!driveReady) return <Onboarding />;
  return <OnlineHome />;
}
