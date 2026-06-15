// ════════════════════════════════════════════════════════════
//  ERROR BOUNDARY — A safety net. If something inside throws, we
//  show a small recoverable message instead of a blank screen, and
//  the rest of the app (like the bottom nav) keeps working.
//
//  (Error boundaries must be class components — this is the one
//  place in the app that uses a class.)
// ════════════════════════════════════════════════════════════

import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Helpful for debugging in the browser console.
    console.error("Screen error:", error, info);
  }

  // Reset when navigating to a different screen.
  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#030712" }}>
          <div className="text-center max-w-xs">
            <div className="w-14 h-14 rounded-full bg-rose-500/15 flex items-center justify-center mx-auto mb-3 text-2xl">⚠️</div>
            <p className="text-white font-semibold mb-1">Something went wrong on this screen</p>
            <p className="text-white/40 text-sm mb-4">{String(this.state.error?.message || this.state.error)}</p>
            <button
              onClick={() => this.setState({ error: null })}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
