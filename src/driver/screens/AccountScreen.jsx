// ════════════════════════════════════════════════════════════
//  ACCOUNT (driver) — Profile, what is needed to drive (vehicle,
//  Lightning address), driving settings (deposit %, request radius,
//  alerts), wallet, contact methods, relays, keys, log out.
// ════════════════════════════════════════════════════════════

import { useApp } from "../../state/AppContext.jsx";
import { useDriver } from "../state/DriverContext.jsx";
import { Screen } from "../../ui/Layout.jsx";
import { SectionLabel, Toggle, inputCls } from "../../ui/Parts.jsx";
import { AccountHeader, ContactMethods, RelaysSection, LogoutButton, useSaveProfile } from "../../features/profile/ProfileParts.jsx";
import VehicleSection from "../../features/profile/VehicleSection.jsx";
import LightningAddressSection from "../../features/profile/LightningAddressSection.jsx";
import WalletSection from "../../features/profile/WalletSection.jsx";
import KeysSection from "../../features/profile/KeysSection.jsx";
import Icon from "../../ui/Icon.jsx";

const DEPOSITS = [0, 10, 20, 30, 50];

export default function AccountScreen() {
  const { user } = useApp();
  const { driveReady, depositPct, setDepositPct, radius, setRadius, alerts, setAlerts } = useDriver();
  const save = useSaveProfile();
  return (
    <Screen title="Account">
      <div className="space-y-7">
        <AccountHeader photoRequired />

        <div className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${driveReady ? "bg-[#e6f4ec] text-[#05683a]" : "bg-amber-50 text-amber-800"}`}>
          <Icon name={driveReady ? "check" : "alert"} size={20} />
          <p className="text-sm font-semibold">{driveReady ? "You're ready to drive." : "Add your photo, vehicle, plate and Lightning address to start driving."}</p>
        </div>

        <VehicleSection vehicle={user.vehicle} ready={driveReady} onSave={(vehicle) => save({ vehicle })} />
        <LightningAddressSection value={user.lud16 || ""} onSave={(lud16) => save({ lud16 })} />

        <section>
          <SectionLabel>Driving</SectionLabel>
          <div className="space-y-4">
            <div>
              <p className="font-medium">Deposit when you accept</p>
              <p className="text-sm text-neutral-500 mb-2">Paid by the rider up front to cover your drive to them. Not refunded if they cancel after you are on the way.</p>
              <div className="flex gap-2" role="group" aria-label="Deposit percent">
                {DEPOSITS.map((p) => (
                  <button key={p} type="button" aria-pressed={depositPct === p} onClick={() => setDepositPct(p)}
                    className={`flex-1 py-2.5 rounded-full text-sm font-semibold ${depositPct === p ? "bg-black text-white" : "bg-neutral-100 text-neutral-700"}`}>
                    {p === 0 ? "None" : `${p}%`}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="font-medium">Request radius</p>
                <p className="text-sm text-neutral-500">Only show pickups this close.</p>
              </div>
              <input aria-label="Request radius in miles" type="number" min="1" max="100" value={radius}
                onChange={(e) => setRadius(Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                className={`${inputCls} !w-20 text-center`} />
              <span className="text-sm text-neutral-500">mi</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="font-medium">New request alerts</p>
                <p className="text-sm text-neutral-500">Banner and notification while you are online.</p>
              </div>
              <Toggle checked={alerts} onChange={setAlerts} label="New request alerts" />
            </div>
          </div>
        </section>

        <WalletSection />
        <ContactMethods />
        <RelaysSection />
        <KeysSection user={user} />
        <LogoutButton />
      </div>
    </Screen>
  );
}
