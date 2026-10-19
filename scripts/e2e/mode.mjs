// The Ride / Drive switch of the one app:
//   • a person starts in Ride; the switch (Ride | Drive) is on Home, Activity / Earnings and Account; tabs follow the face
//   • one wallet and one set of 12 words for the person, in both faces (one saved phrase, one saved wallet, the same balance)
//   • the face is saved per account on the device (a reload and a new sign-in keep it); another account starts in Ride
//   • a driver who is online is asked first, and "Stay" keeps them online; "Switch" takes them offline
//   • the switch is closed while a ride request is open, and says why; it opens again when the request is closed
// Takes about a minute.
import { boot, sleep, PICKUP, metersNorth } from "./harness.mjs";
import { tap, makeLog, openFold, pinPickup } from "./flow.mjs";

const h = await boot();
const log = makeLog();
let P, R, ok = false;
const step = async (name, fn) => {
  try { await fn(); log("ok  ", name); }
  catch (e) {
    log("FAIL", name, "-", e.message.split("\n").slice(0, 6).join(" | "));
    for (const [n, p] of [["person", P], ["rider", R]]) if (p) log(`${n} page text:`, (await p.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 600));
    log("errors:", h.errors);
    throw e;
  }
};
const tabs = (p) => p.locator('nav[aria-label="Main"]');
const tabNames = async (p) => (await tabs(p).locator("button").evaluateAll((bs) => bs.map((b) => b.innerText.replace(/\s+/g, " ").trim().replace(/^\d+\s*/, ""))));
const sw = (p) => p.getByRole("group", { name: "Ride or drive" });
const face = async (p) => ((await sw(p).first().getByRole("button", { name: "Drive" }).getAttribute("aria-pressed")) === "true" ? "drive" : "ride");
const toAccount = (p) => tap(tabs(p).getByText("Account", { exact: true }));
const balance = async (p) => Number(((await p.getByText("Balance").first().locator("..").innerText()).match(/([\d,]+) sats/) || [0, "0"])[1].replace(/,/g, ""));

try {
  const pc = await h.newContext("person", metersNorth(PICKUP, 25));
  P = pc.page;
  await h.login(P, h.driver, h.riderUrl); // a person who can drive, opening the app for the first time: Ride

  await step("a new account starts in Ride: three tabs, and the switch on Home", async () => {
    await tabs(P).waitFor({ timeout: 40000 });
    const names = await tabNames(P);
    if (names.join("|") !== "Ride|Activity|Account") throw new Error("tabs: " + names.join("|"));
    await sw(P).first().waitFor({ timeout: 10000 });
    if ((await face(P)) !== "ride") throw new Error("not in Ride");
  });

  await step("one wallet and one set of 12 words: filled in Ride, the same money in Drive", async () => {
    await toAccount(P);
    await openFold(P, "Wallets");
    await P.getByRole("button", { name: /Add funds/ }).first().click();
    await P.getByRole("button", { name: "Show invoice" }).click();
    for (let i = 0; i < 40 && ![...h.mint.quotes.values()].some((q) => q.state === "UNPAID"); i++) await sleep(250);
    for (const [k, q] of h.mint.quotes) if (q.state === "UNPAID") h.mint.payQuote(k);
    await P.getByText(/added/).waitFor({ timeout: 20000 });
    await P.getByRole("button", { name: "Done" }).click();
    if ((await balance(P)) !== 5000) throw new Error("expected 5,000 sats in Ride: " + (await balance(P)));
    await sw(P).first().getByRole("button", { name: "Drive" }).click();
    await tabs(P).getByText("Earnings", { exact: true }).waitFor({ timeout: 15000 });
    const names = await tabNames(P);
    if (names.join("|") !== "Drive|Earnings|Account") throw new Error("tabs in Drive: " + names.join("|"));
    if ((await face(P)) !== "drive") throw new Error("not in Drive");
    await P.getByText("Vehicle & plate").first().waitFor({ timeout: 10000 }); // the driver's Account: still on the Account tab
    if (await P.getByText("Trusted contacts").count()) throw new Error("a rider-only section shows in Drive");
    await openFold(P, "Wallets");
    await P.getByText("Balance").first().waitFor({ timeout: 10000 });
    if ((await balance(P)) !== 5000) throw new Error("the Drive face sees another wallet: " + (await balance(P)));
    const keys = await P.evaluate(() => Object.keys(localStorage));
    const phrases = keys.filter((k) => k.startsWith("nostrride_ecashphrase_")), wallets = keys.filter((k) => /^nostrride_ecash_[0-9a-f]{16}$/.test(k));
    if (phrases.length !== 1 || wallets.length !== 1) throw new Error(`expected 1 phrase and 1 wallet, saw ${phrases.length} and ${wallets.length}`);
  });

  await step("the face is saved per account: a new sign-in returns to Drive; another account starts in Ride", async () => {
    await P.reload();
    await h.login(P, h.driver, h.riderUrl);
    await tabs(P).getByText("Earnings", { exact: true }).waitFor({ timeout: 40000 });
    if ((await face(P)) !== "drive") throw new Error("the saved face was lost");
    await P.reload();
    await h.login(P, h.rider, h.riderUrl);
    await tabs(P).getByText("Activity", { exact: true }).waitFor({ timeout: 40000 });
    if ((await face(P)) !== "ride") throw new Error("another account should start in Ride");
    await P.reload();
    await h.login(P, h.driver, h.riderUrl);
    await tabs(P).getByText("Earnings", { exact: true }).waitFor({ timeout: 40000 });
  });

  await step("a driver who is online is asked first; Stay keeps them online, Switch takes them offline", async () => {
    await tap(tabs(P).getByText("Drive", { exact: true }));
    await P.getByRole("button", { name: "Go online" }).click({ timeout: 40000 });
    await P.getByText("You're online").waitFor({ timeout: 15000 });
    await sw(P).first().getByRole("button", { name: "Ride" }).click();
    const dlg = P.getByRole("dialog");
    await dlg.waitFor({ timeout: 5000 });
    if (!/go offline/.test(await dlg.innerText())) throw new Error("the dialog does not say they go offline");
    await dlg.getByRole("button", { name: /Stay in Drive/ }).click();
    await P.getByText("You're online").waitFor({ timeout: 5000 });
    if ((await face(P)) !== "drive") throw new Error("Stay should keep the Drive face");
    await sw(P).first().getByRole("button", { name: "Ride" }).click();
    await P.getByRole("dialog").getByRole("button", { name: "Switch", exact: true }).click();
    await tabs(P).getByText("Activity", { exact: true }).waitFor({ timeout: 15000 });
    await sw(P).first().getByRole("button", { name: "Drive" }).click();
    await P.getByRole("button", { name: "Go online" }).waitFor({ timeout: 15000 }); // offline again
  });

  await step("a rider with a request open cannot switch, is told why, and can after closing it", async () => {
    const rc = await h.newContext("rider", PICKUP);
    R = rc.page;
    await h.login(R, h.rider, h.riderUrl);
    await R.getByRole("button", { name: /Where to\?/ }).click({ timeout: 40000 });
    await R.getByLabel("Pickup location").waitFor();
    await pinPickup(R);
    await R.getByLabel("Where to?").fill("Blue Grass");
    await R.getByText("Blue Grass Airport", { exact: false }).first().click({ timeout: 10000 });
    await R.getByRole("button", { name: /Request ride · / }).click({ timeout: 15000 });
    await R.getByText("Finding your driver").first().waitFor({ timeout: 15000 });
    await toAccount(R);
    await sw(R).first().getByRole("button", { name: "Drive" }).click({ force: true }); // marked aria-disabled, but a tap still answers why
    await R.getByText("Finish or close your ride first.").first().waitFor({ timeout: 5000 });
    if ((await face(R)) !== "ride") throw new Error("the switch moved with a request open");
    await tap(tabs(R).getByText("Ride", { exact: true }));
    await tap(R.getByRole("button", { name: "Close request" }));
    await tap(R.getByRole("button", { name: "Close request" }).last()); // the confirmation
    await R.getByRole("button", { name: /Where to\?/ }).waitFor({ timeout: 15000 });
    await toAccount(R);
    await sw(R).first().getByRole("button", { name: "Drive" }).click();
    await tabs(R).getByText("Earnings", { exact: true }).waitFor({ timeout: 15000 });
  });

  const miss = [...(await h.missingStyles(P)), ...(await h.missingStyles(R))].filter((c) => !/^leaflet/.test(c));
  log("class names on screen with no CSS rule:", miss.length ? miss.join(" ") : "none");
  log("errors:", h.errors.length ? h.errors : "none");
  ok = !h.errors.length;
} catch { log("RUN FAILED"); } finally { await h.stop(); }
process.exit(ok ? 0 : 1);
