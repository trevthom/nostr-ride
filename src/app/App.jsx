// ════════════════════════════════════════════════════════════
//  NOSTRRIDE — The one app. A person signs in once and uses it as a PASSENGER (Ride) or as a DRIVER (Drive), switching with the
//  Ride / Drive switch (src/ui/ModeSwitch.jsx). Everything else is shared: the key, the profile, the ecash wallet and its 12 words,
//  the settings. The face on screen decides which role state is mounted and which three tabs show:
//
//    Ride   RiderProvider  →  Ride (home) · Activity · Account
//    Drive  DriverProvider →  Drive (home) · Earnings · Account
//
//  The tab bar is always visible. Only ONE role state runs at a time (a switch remounts it), so the app never pays ticks as a rider
//  while it sends a driver's car location. The switch is closed while a ride is under way (RideShell / DriveShell set `lock`), and a
//  driver who is online is asked first: switching takes them offline. The choice is saved per account (lib/mode.js).
//  src/config/app.js `setAppRole` is called BEFORE a face is drawn, so every screen reads the right role while it draws.
//  src/rider and src/driver never import each other; this file is the only place that knows both.
// ════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { AppProvider, useApp } from "../state/AppContext.jsx";
import { RiderProvider, useRider } from "../rider/state/RiderContext.jsx";
import { DriverProvider, useDriver } from "../driver/state/DriverContext.jsx";
import { AppFrame, TabBar } from "../ui/Layout.jsx";
import { ModeProvider } from "../ui/ModeSwitch.jsx";
import ErrorBoundary from "../ui/ErrorBoundary.jsx";
import UserModal from "../ui/UserModal.jsx";
import NoticeBanner from "../ui/NoticeBanner.jsx";
import ConnectionBanner from "../ui/ConnectionBanner.jsx";
import AuthScreen from "../features/auth/AuthScreen.jsx";
import RideHome from "../rider/screens/HomeScreen.jsx";
import ActivityScreen from "../rider/screens/ActivityScreen.jsx";
import RiderAccount from "../rider/screens/AccountScreen.jsx";
import DriveHome from "../driver/screens/HomeScreen.jsx";
import EarningsScreen from "../driver/screens/EarningsScreen.jsx";
import DriverAccount from "../driver/screens/AccountScreen.jsx";
import { setAppRole } from "../config/app.js";
import { getMode, saveMode, roleOf, viewFor } from "../lib/mode.js";

const RIDE_SCREENS = { home: RideHome, activity: ActivityScreen, account: RiderAccount };
const RIDE_TABS = [
  { id: "home", label: "Ride", icon: "car" },
  { id: "activity", label: "Activity", icon: "clock" },
  { id: "account", label: "Account", icon: "user" },
];
const DRIVE_SCREENS = { drive: DriveHome, earnings: EarningsScreen, account: DriverAccount };

function RideShell({ onSwitch }) {
  const { view, setView } = useApp();
  const { activeRide, receipt, plan, resetPlan } = useRider();
  const shown = viewFor("ride", view);
  const Screen = RIDE_SCREENS[shown];
  const onTab = (id) => {
    if (id === "home" && shown === "home" && !activeRide && !receipt && plan.step !== "idle") resetPlan();
    else setView(id);
  };
  return (
    <ModeProvider mode="ride" lock={activeRide ? "Finish or close your ride first." : null} onSwitch={onSwitch}>
      <AppFrame>
        <ErrorBoundary resetKey={shown}>
          <Screen />
        </ErrorBoundary>
        <TabBar items={RIDE_TABS} active={shown} onChange={onTab} />
        <UserModal />
        <ConnectionBanner />
        <NoticeBanner />
      </AppFrame>
    </ModeProvider>
  );
}

function DriveShell({ onSwitch }) {
  const { view, setView } = useApp();
  const { open, online, driveReady, alerts, activeDrive, goOffline } = useDriver();
  const shown = viewFor("drive", view);
  const Screen = DRIVE_SCREENS[shown];
  const tabs = [
    { id: "drive", label: "Drive", icon: "car", badge: online && (shown !== "drive" || !alerts) ? open.length : 0 },
    { id: "earnings", label: "Earnings", icon: "chart" },
    { id: "account", label: "Account", icon: "user", badge: !driveReady ? 1 : 0 },
  ];
  const leave = useCallback((next) => { goOffline(); onSwitch(next); }, [goOffline, onSwitch]);
  return (
    <ModeProvider mode="drive" lock={activeDrive ? "Finish your drive first." : null} warn={online ? "You will go offline, and riders will not see your car." : null} onSwitch={leave}>
      <AppFrame>
        <ErrorBoundary resetKey={shown}>
          <Screen />
        </ErrorBoundary>
        <TabBar items={tabs} active={shown} onChange={setView} />
        <UserModal />
        <ConnectionBanner />
        <NoticeBanner />
      </AppFrame>
    </ModeProvider>
  );
}

// One signed-in person. The face (ride or drive) is state here, so a switch remounts only the role state below it.
function Session({ user }) {
  const { view, setView } = useApp();
  const [mode, setMode] = useState(() => getMode(user.publicKey));
  setAppRole(roleOf(mode)); // before the face is drawn: its screens read the role while they draw
  const switchTo = useCallback((next) => {
    saveMode(user.publicKey, next);
    setMode(next);
    setView((v) => viewFor(next, v));
  }, [user.publicKey, setView]);
  // The tab on screen must belong to the face (after a login the app starts on "home").
  useEffect(() => { const v = viewFor(mode, view); if (v !== view) setView(v); }, [mode, view, setView]);
  return mode === "drive" ? (
    <DriverProvider key="drive"><DriveShell onSwitch={switchTo} /></DriverProvider>
  ) : (
    <RiderProvider key="ride"><RideShell onSwitch={switchTo} /></RiderProvider>
  );
}

function Gate() {
  const { user, setUser } = useApp();
  if (!user) return <AuthScreen onLogin={setUser} />;
  return <Session key={user.publicKey} user={user} />;
}

export default function NostrRideApp() {
  return (
    <AppProvider initialView="home">
      <Gate />
    </AppProvider>
  );
}
