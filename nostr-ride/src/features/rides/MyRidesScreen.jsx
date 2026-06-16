// ════════════════════════════════════════════════════════════
//  MY ACTIVITY — Current activity (active requests, drives in
//  progress, pending offers) plus collapsible history: Past Rides
//  (as a rider) and Past Drives (as a driver). Polls so updates from
//  the other party appear quickly.
// ════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { useApp } from "../../state/AppContext.jsx";
import { relay } from "../../nostr/relay.js";
import { EVENT_KINDS } from "../../nostr/eventKinds.js";
import { isRideExpired } from "../../lib/rides.js";
import Screen from "../../ui/Screen.jsx";
import Collapsible from "../../ui/Collapsible.jsx";
import SatsAmount from "../../ui/SatsAmount.jsx";

const DAY = 86400000;
const parse = (e) => { try { return JSON.parse(e.content); } catch { return null; } };
const dtagOf = (e) => (e.tags.find((t) => t[0] === "d") || [])[1];
const fmtTime = (sec) => new Date(sec * 1000).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
const vehicleLabel = (v) => (!v || v === "Not specified" ? "No vehicle specified" : v);

export default function MyRidesScreen() {
  const { user, setView, rideRequests, pullRecent, cancelRequest, setSelectedRequest, setActiveRide } = useApp();

  // Pull on open + poll so the other party's actions show up quickly.
  useEffect(() => {
    pullRecent();
    const id = setInterval(() => pullRecent(), 10000);
    return () => clearInterval(id);
  }, [pullRecent]);

  const now = Date.now();
  const mine = (r) => r.pubkey === user.publicKey;
  const statusOf = (r) => parse(r)?.status;

  // Rider side
  const activeRequests = rideRequests
    .filter((r) => mine(r) && ["requested", "accepted", "in_progress"].includes(statusOf(r)))
    // Hide expired open requests (ASAP after 1h; Timed 1h after pickup time).
    .filter((r) => statusOf(r) !== "requested" || !isRideExpired(parse(r), r.created_at))
    .sort((a, b) => b.created_at - a.created_at);
  const pastRides = rideRequests
    .filter((r) => mine(r) && ["completed", "cancelled"].includes(statusOf(r)))
    .filter((r) => statusOf(r) !== "cancelled" || now - r.created_at * 1000 < DAY) // cancelled drop off after 24h
    .sort((a, b) => b.created_at - a.created_at);

  // Driver side
  const driving = (r) => parse(r)?.driverPubkey === user.publicKey;
  const drivingNow = rideRequests
    .filter((r) => driving(r) && statusOf(r) === "in_progress")
    .sort((a, b) => b.created_at - a.created_at);
  const pastDrives = rideRequests
    .filter((r) => driving(r) && statusOf(r) === "completed")
    .sort((a, b) => b.created_at - a.created_at);

  // Pending offers = my offers whose ride is still open ("requested").
  const allReqs = relay.query({ kinds: [EVENT_KINDS.RIDE_REQUEST] });
  const reqById = {};
  const latestByDtag = {};
  allReqs.forEach((e) => {
    reqById[e.id] = e;
    const d = dtagOf(e);
    if (d && (!latestByDtag[d] || e.created_at > latestByDtag[d].created_at)) latestByDtag[d] = e;
  });
  const offerRideStatus = (offer) => {
    const reqId = (offer.tags.find((t) => t[0] === "e") || [])[1];
    const orig = reqById[reqId];
    const d = orig ? dtagOf(orig) : null;
    const latest = (d && latestByDtag[d]) || orig;
    return latest ? parse(latest)?.status : "requested";
  };
  const myOffers = relay.query({ kinds: [EVENT_KINDS.RIDE_OFFER], authors: [user.publicKey] });
  const pendingOffers = myOffers.filter((o) => offerRideStatus(o) === "requested");

  const nothing =
    activeRequests.length === 0 && pastRides.length === 0 && drivingNow.length === 0 &&
    pastDrives.length === 0 && pendingOffers.length === 0;

  return (
    <Screen title="My Activity" right={<button onClick={pullRecent} className="text-cyan-400 text-xs">Refresh</button>}>
      <div className="space-y-5">
        {drivingNow.length > 0 && (
          <Section label="Driving Now">
            {drivingNow.map((r) => {
              const c = parse(r);
              return (
                <div key={r.id} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-white/80 text-sm">{c.pickup.name} → {c.dropoff.name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">accepted</span>
                  </div>
                  <button
                    onClick={() => { setSelectedRequest(r); setView("driver-active"); }}
                    className="text-cyan-400 text-sm font-medium"
                  >
                    See Drive Details →
                  </button>
                </div>
              );
            })}
          </Section>
        )}

        {activeRequests.length > 0 && (
          <Section label="My Ride Requests">
            {activeRequests.map((req) => (
              <MyRequestRow
                key={req.id}
                req={req}
                onCancel={() => cancelRequest(req)}
                onViewOffers={() => { setSelectedRequest(req); setView("rider-select"); }}
                onViewActive={() => { setActiveRide({ request: req, status: "in_progress" }); setView("ride-progress"); }}
              />
            ))}
          </Section>
        )}

        {pendingOffers.length > 0 && (
          <Section label="My Offers">
            {pendingOffers.map((offer) => {
              const c = parse(offer);
              return (
                <div key={offer.id} className="rounded-xl border border-white/10 p-4 mb-2 bg-white/[0.02]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/80 text-sm"><SatsAmount sats={c.priceSats} /> · {c.etaMinutes}m ETA</p>
                      <p className="text-white/30 text-xs">{vehicleLabel(c.vehicle)}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">Pending</span>
                  </div>
                </div>
              );
            })}
          </Section>
        )}

        {pastRides.length > 0 && (
          <Collapsible title="Past Rides" count={pastRides.length}>
            {pastRides.map((r) => <PastRow key={r.id} req={r} role="rider" />)}
          </Collapsible>
        )}

        {pastDrives.length > 0 && (
          <Collapsible title="Past Drives" count={pastDrives.length}>
            {pastDrives.map((r) => <PastRow key={r.id} req={r} role="driver" />)}
          </Collapsible>
        )}

        {nothing && (
          <div className="pt-16 text-center">
            <p className="text-white/30 text-lg mb-2">No activity yet</p>
            <p className="text-white/20 text-sm">Request a ride or offer one to get started.</p>
          </div>
        )}
      </div>
    </Screen>
  );
}

function Section({ label, children }) {
  return (
    <div>
      <p className="text-white/30 text-xs uppercase tracking-widest mb-2">{label}</p>
      {children}
    </div>
  );
}

// A past ride/drive (completed or cancelled) with its date & time.
function PastRow({ req, role }) {
  const c = parse(req);
  if (!c) return null;
  const completed = c.status === "completed";
  return (
    <div className="rounded-xl border border-white/10 p-4 mb-2 bg-white/[0.02]">
      <div className="flex items-center justify-between mb-1">
        <p className="text-white/70 text-sm">{c.pickup.name} → {c.dropoff.name}</p>
        <span className={`text-xs px-2 py-0.5 rounded-full ${completed ? "bg-emerald-500/15 text-emerald-400" : "bg-white/10 text-white/40"}`}>
          {c.status}
        </span>
      </div>
      <p className="text-white/30 text-xs">
        {completed ? "Completed" : "Cancelled"} {fmtTime(req.created_at)}
        {role === "driver" && completed ? " · you drove" : ""}
      </p>
      {role === "driver" && completed && <RateRider req={req} />}
    </div>
  );
}

// Lets the driver leave a star rating + review for the rider after a drive.
function RateRider({ req }) {
  const { user, publish } = useApp();
  const rideId = req.id;
  const riderPubkey = req.pubkey;
  const alreadyRated =
    relay.query({ kinds: [EVENT_KINDS.RATING], authors: [user.publicKey], "#e": [rideId] }).length > 0;
  const [done, setDone] = useState(alreadyRated);
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(5);
  const [review, setReview] = useState("");

  const submit = () => {
    publish(
      EVENT_KINDS.RATING,
      { rating: stars, review, rideId },
      [["p", riderPubkey], ["e", rideId], ["d", "rating-" + rideId], ["t", "rating"]]
    );
    setDone(true);
    setOpen(false);
  };

  if (done) return <p className="text-white/30 text-xs mt-2">You rated this rider.</p>;
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="text-cyan-400 text-xs font-medium mt-2">
        Rate rider →
      </button>
    );

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <div className="flex gap-1 mb-2">
        {[1, 2, 3, 4, 5].map((s) => (
          <button key={s} onClick={() => setStars(s)} className={`text-xl ${s <= stars ? "text-amber-400" : "text-white/20"}`}>★</button>
        ))}
      </div>
      <textarea
        value={review}
        onChange={(e) => setReview(e.target.value)}
        placeholder={stars < 5 ? "Explain what went wrong (required)" : "How was the rider? (optional)"}
        rows={2}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-cyan-500/50 resize-none mb-2"
      />
      {stars < 5 && !review.trim() && (
        <p className="text-amber-400/80 text-xs mb-2">An explanation is required for ratings under 5 stars.</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={stars < 5 && !review.trim()}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 disabled:opacity-40"
        >
          Submit
        </button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg text-xs text-white/40">Cancel</button>
      </div>
    </div>
  );
}

// A row for one of the user's own ACTIVE requests, with the right action.
function MyRequestRow({ req, onCancel, onViewOffers, onViewActive }) {
  const c = parse(req);
  if (!c) return null;
  const offers = relay.query({ kinds: [EVENT_KINDS.RIDE_OFFER], "#e": [req.id] });
  const canCancel = c.status === "requested" || c.status === "accepted";

  const statusStyle =
    c.status === "requested"
      ? "bg-cyan-500/15 text-cyan-400"
      : c.status === "in_progress"
      ? "bg-emerald-500/15 text-emerald-400"
      : "bg-amber-500/15 text-amber-400";

  return (
    <div className="rounded-xl border border-white/10 p-4 mb-2 bg-white/[0.02]">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-white/80">{c.pickup.name} → {c.dropoff.name}</div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${statusStyle}`}>{c.status}</span>
      </div>

      <div className="flex items-center gap-4 mt-1">
        {offers.length > 0 && c.status !== "in_progress" && (
          <button onClick={onViewOffers} className="text-cyan-400 text-sm font-medium">
            View {offers.length} offer{offers.length > 1 ? "s" : ""} →
          </button>
        )}
        {c.status === "in_progress" && (
          <button onClick={onViewActive} className="text-emerald-400 text-sm font-medium">
            View Active Ride →
          </button>
        )}
        {canCancel && (
          <button onClick={onCancel} className="text-rose-400 text-sm font-medium ml-auto">
            Cancel request
          </button>
        )}
      </div>
    </div>
  );
}
