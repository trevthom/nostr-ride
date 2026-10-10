// relay.publish resolves on the first relay ack, false if all fail, no unhandled rejections.
// Run with: npm test
import assert from "node:assert/strict";
const { relay } = await import("../src/nostr/relay.js");
const delay = (ms, ok) => new Promise((res, rej) => setTimeout(() => (ok ? res("ok") : rej(new Error("connection failed"))), ms));
let n = 0; const ev = () => ({ id: "x" + ++n, pubkey: "a", kind: 30078, created_at: 1, tags: [], content: "{}" });
let unhandled = 0; process.on("unhandledRejection", () => unhandled++);
relay.pool.publish = () => [delay(50, false), delay(20, true), delay(5000, true)];
let t = Date.now(); assert.equal(await relay.publish(ev()), true); assert.ok(Date.now() - t < 1000, "resolves on first ack, not the slowest relay");
relay.pool.publish = () => [delay(10, false), delay(30, false)];
assert.equal(await relay.publish(ev()), false);
relay.pool.publish = () => [];
assert.equal(await relay.publish(ev()), false);
await new Promise((r) => setTimeout(r, 100));
assert.equal(unhandled, 0, "no unhandled rejections");
console.log("publish checks passed"); process.exit(0);
