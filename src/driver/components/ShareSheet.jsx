// ════════════════════════════════════════════════════════════
//  SHARE SHEET (driver) — "Share my trip" on a running drive, the same way
//  the rider shares: a live link (nostr/share.js) that follows this phone
//  (the car) on a map. Trusted contacts are set in Account and stay on this
//  device. Viewers need no account; stopping the share only stops updates.
// ════════════════════════════════════════════════════════════

import { useDriver } from "../state/DriverContext.jsx";
import { Modal } from "../../ui/Parts.jsx";
import ShareTrip from "../../features/share/ShareTrip.jsx";

export default function ShareSheet({ open, onClose, request, destination }) {
  const { share, startShare, stopShare, shareUrl } = useDriver();
  return (
    <Modal open={open} title="Share my trip" onClose={onClose}>
      <ShareTrip request={request} destination={destination} share={share} startShare={startShare} stopShare={stopShare} shareUrl={shareUrl} heading={null} onClose={onClose} />
    </Modal>
  );
}
