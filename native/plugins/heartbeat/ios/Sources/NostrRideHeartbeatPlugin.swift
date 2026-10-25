import Foundation
import UIKit
import WebKit
import Capacitor

// ════════════════════════════════════════════════════════════
//  HEARTBEAT (iOS) — a metronome from the shell into the page.
//
//  The rider's payment loop lives in the page (features/payments/rideTicks.js) and
//  runs on a 3 s timer. iOS throttles a hidden page's timers, so a rider whose phone
//  is in a pocket stops paying even though the app is alive — and when the phone stops
//  MOVING, the background-location watcher has no fix to deliver either, so the fixes
//  that used to wake the page dry up exactly when the ride is longest.
//
//  This plugin is the missing clock: while the app runs (the location session is what
//  keeps it running), a native Timer fires and evaluates one line of JavaScript, which
//  resumes the web content and lets the payment pass do its work.
//
//  What it does NOT do: it holds no key, no coin and no wallet code, and it never
//  signs or publishes anything. The page still pays the ride; this only tells it when.
// ════════════════════════════════════════════════════════════

private let defaultIntervalMs: Double = 15_000
private let minIntervalMs: Double = 2_000
private let maxIntervalMs: Double = 60_000
// The one thing the page and the shell agree on: a function the page installs while a ride runs.
private let beatJS = "window.__nostrRideBeat && window.__nostrRideBeat();"

@objc(NostrRideHeartbeatPlugin)
public class NostrRideHeartbeatPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NostrRideHeartbeatPlugin"
    public let jsName = "NostrRideHeartbeat"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private var timer: Timer?
    private var intervalMs: Double = defaultIntervalMs

    @objc func start(_ call: CAPPluginCall) {
        let asked = call.getDouble("intervalMs") ?? defaultIntervalMs
        let clamped = min(max(asked, minIntervalMs), maxIntervalMs)
        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                call.resolve()
                return
            }
            self.intervalMs = clamped
            self.stopTimer()
            self.startTimer()
            call.resolve(["intervalMs": clamped])
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.stopTimer()
            call.resolve()
        }
    }

    private func startTimer() {
        let timer = Timer(timeInterval: intervalMs / 1000.0, repeats: true) { [weak self] _ in
            self?.beat()
        }
        // A little slack: this is a metronome, not a heartbeat monitor.
        timer.tolerance = intervalMs / 4000.0
        // .common, so a scroll or a sheet tracking still lets it fire.
        RunLoop.main.add(timer, forMode: .common)
        self.timer = timer
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    private func beat() {
        // In the foreground the page's own 3 s loop already runs; beating then would only cost battery.
        guard UIApplication.shared.applicationState != .active else { return }
        // No web view any more (the bridge is gone): there is nobody left to wake, so stop ticking.
        guard let webView = bridge?.webView else {
            stopTimer()
            return
        }
        // Evaluating JavaScript wakes the web content process, which iOS suspended with the page.
        webView.evaluateJavaScript(beatJS, completionHandler: nil)
    }
}
