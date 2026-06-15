// ════════════════════════════════════════════════════════════
//  APP — The root. It does three small things:
//    1. Wraps everything in the shared state (AppProvider).
//    2. If nobody is logged in, shows the AuthScreen.
//    3. Otherwise shows whichever screen matches `view` plus the
//       bottom navigation.
//
//  The bottom-nav tabs (top-level screens) are:
//    Ride · Drive · Activity · Account
//  The default screen after login is "rider-request" (Ride), set in
//  state/AppContext.jsx.
//
//  To add a NEW screen:
//    a) create it under src/features/.../YourScreen.jsx
//    b) import it below
//    c) add one line to the SCREENS map
//    d) (optional) add a tab in src/ui/BottomNav.jsx
// ════════════════════════════════════════════════════════════

import { AppProvider, useApp } from "./state/AppContext.jsx";
import BottomNav from "./ui/BottomNav.jsx";
import ErrorBoundary from "./ui/ErrorBoundary.jsx";
import UserModal from "./ui/UserModal.jsx";

import AuthScreen from "./features/auth/AuthScreen.jsx";
import RiderRequestScreen from "./features/rides/RiderRequestScreen.jsx";
import DriverBrowseScreen from "./features/rides/DriverBrowseScreen.jsx";
import DriverOfferScreen from "./features/rides/DriverOfferScreen.jsx";
import MyRidesScreen from "./features/rides/MyRidesScreen.jsx";
import RiderSelectScreen from "./features/rides/RiderSelectScreen.jsx";
import PaymentScreen from "./features/rides/PaymentScreen.jsx";
import RideProgressScreen from "./features/rides/RideProgressScreen.jsx";
import DriverActiveRideScreen from "./features/rides/DriverActiveRideScreen.jsx";
import ProfileScreen from "./features/profile/ProfileScreen.jsx";

// Maps a `view` name to the screen component that renders it.
const SCREENS = {
  "rider-request": RiderRequestScreen,
  "driver-browse": DriverBrowseScreen,
  "driver-offer": DriverOfferScreen,
  "my-rides": MyRidesScreen,
  "rider-select": RiderSelectScreen,
  payment: PaymentScreen,
  "ride-progress": RideProgressScreen,
  "driver-active": DriverActiveRideScreen,
  profile: ProfileScreen,
};

// Chooses and renders the current screen.
function Router() {
  const { user, setUser, view } = useApp();

  // Not logged in -> show the auth screen.
  if (!user) return <AuthScreen onLogin={setUser} />;

  const ScreenComponent = SCREENS[view] || RiderRequestScreen;

  return (
    <div className="max-w-md mx-auto relative" style={{ minHeight: "100vh" }}>
      <ErrorBoundary resetKey={view}>
        <ScreenComponent />
      </ErrorBoundary>
      <BottomNav />
      <UserModal />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}
