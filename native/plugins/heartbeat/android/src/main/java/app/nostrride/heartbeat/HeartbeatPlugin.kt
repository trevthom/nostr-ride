package app.nostrride.heartbeat

import android.os.Handler
import android.os.Looper
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

// ════════════════════════════════════════════════════════════
//  HEARTBEAT (Android) — the same metronome as the iOS plugin.
//
//  The rider's payment loop lives in the page (features/payments/rideTicks.js) and runs
//  on a 3 s timer. Android throttles a backgrounded WebView's timers, and when the phone
//  stops MOVING the background-location watcher has no fix to deliver either, so the page
//  is never woken exactly when a long ride needs it. This handler on the main looper pokes
//  the page instead, which resumes its JavaScript.
//
//  It holds no key, no coin and no wallet code, and it signs nothing: the page still pays
//  the ride, this only tells it when.
// ════════════════════════════════════════════════════════════

@CapacitorPlugin(name = "NostrRideHeartbeat")
class HeartbeatPlugin : Plugin() {

    private val main = Handler(Looper.getMainLooper())
    private var running = false
    private var intervalMs = DEFAULT_INTERVAL_MS

    private val beat = object : Runnable {
        override fun run() {
            if (!running) return
            beatOnce()
            main.postDelayed(this, intervalMs)
        }
    }

    @PluginMethod
    fun start(call: PluginCall) {
        val asked = call.getInt("intervalMs", DEFAULT_INTERVAL_MS.toInt()) ?: DEFAULT_INTERVAL_MS.toInt()
        val clamped = asked.toLong().coerceIn(MIN_INTERVAL_MS, MAX_INTERVAL_MS)
        main.post {
            intervalMs = clamped
            main.removeCallbacks(beat)
            running = true
            main.postDelayed(beat, intervalMs)
            val result = JSObject()
            result.put("intervalMs", intervalMs)
            call.resolve(result)
        }
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        main.post {
            running = false
            main.removeCallbacks(beat)
            call.resolve()
        }
    }

    override fun handleOnDestroy() {
        running = false
        main.removeCallbacks(beat)
    }

    private fun beatOnce() {
        val activity = activity ?: return
        // In the foreground the page's own 3 s loop already runs; beating then would only cost battery.
        if (activity.hasWindowFocus()) return
        val webView = bridge?.webView ?: return
        webView.evaluateJavascript(BEAT_JS, null)
    }

    companion object {
        private const val DEFAULT_INTERVAL_MS = 15_000L
        private const val MIN_INTERVAL_MS = 2_000L
        private const val MAX_INTERVAL_MS = 60_000L
        // The one thing the page and the shell agree on: a function the page installs while a ride runs.
        private const val BEAT_JS = "window.__nostrRideBeat && window.__nostrRideBeat();"
    }
}
