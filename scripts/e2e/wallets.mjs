// Account → Wallets and the settings changes, in BOTH apps:
//   • the Account list has Wallets and no Backup, Currency, Cash out location or Lightning wallet section of its own
//   • inside Wallets: Currency first, then the ecash wallet ("Add ecash here before you ride." and nothing about paying a driver),
//     Add funds and Send side by side, then Cash out location, then the Lightning wallet (NWC)
//   • Add funds has a Lightning tab and an On-chain tab: the mint gives a bitcoin address; a confirmed payment becomes ecash
//   • a cash out location saved in one app is the same in the other app (same nsec)
//   • the driver may add up to 3 vehicle photos and only one is needed to drive
//   • "Your vouches" has the new wording
// Takes about a minute.
import { boot, sleep, PICKUP, metersNorth } from "./harness.mjs";
import { tap, makeLog, openFold } from "./flow.mjs";

const h = await boot();
const log = makeLog();
let R, D, ok = false;
const step = async (name, fn) => {
  try { await fn(); log("ok  ", name); }
  catch (e) {
    log("FAIL", name, "-", e.message.split("\n").slice(0, 6).join(" | "));
    for (const [n, p] of [["rider", R], ["driver", D]]) if (p) log(`${n} page text:`, (await p.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 700));
    log("errors:", h.errors);
    throw e;
  }
};
const tabs = (p) => p.locator('nav[aria-label="Main"]');
const folds = (p) => p.locator("section h2 button").evaluateAll((bs) => bs.map((b) => b.innerText.replace(/\s+/g, " ").trim()));
const walletsText = async (p) => (await p.locator("section", { has: p.locator("h2 button", { hasText: "Wallets" }) }).first().innerText()).replace(/\s+/g, " ");
const lightningServer = async (ctx) => {
  await ctx.route(/example\.com\/\.well-known\/lnurlp\//, (r) => r.fulfill({ json: { tag: "payRequest", callback: "https://example.com/lnurlp/cb", minSendable: 1000, maxSendable: 100000000000 }, headers: { "access-control-allow-origin": "*" } }));
};
const shot = async (p, name) => { if (process.env.E2E_SHOTS) await p.screenshot({ path: `${process.env.E2E_SHOTS}/${name}.png` }); };
const PNG = { name: "car.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64") };

try {
  const rc = await h.newContext("rider", PICKUP);
  const dc = await h.newContext("driver", metersNorth(PICKUP, 25));
  R = rc.page; D = dc.page;
  await lightningServer(rc.ctx); await lightningServer(dc.ctx);
  await h.login(R, h.rider, h.riderUrl);
  await h.login(D, h.driver, h.driverUrl);
  await tap(tabs(R).getByText("Account", { exact: true }));
  await tap(tabs(D).getByText("Account", { exact: true }));

  for (const [role, P] of [["rider", R], ["driver", D]]) {
    await step(`${role}: Wallets replaces Backup, Currency, Cash out location and Lightning wallet`, async () => {
      await P.locator("section h2 button").first().waitFor({ timeout: 40000 });
      const list = await folds(P);
      if (!list.some((t) => t.startsWith("Wallets"))) throw new Error("no Wallets section: " + list.join(" | "));
      for (const gone of ["Backup", "Currency", "Cash out location", "Lightning wallet", "Ecash wallet"]) {
        if (list.some((t) => t.startsWith(gone))) throw new Error(`"${gone}" should not be a section of its own: ` + list.join(" | "));
      }
    });
    await step(`${role}: inside Wallets, in order: Currency, Ecash wallet, Cash out location, Lightning wallet (NWC); the new wording`, async () => {
      await openFold(P, "Wallets");
      const t = await walletsText(P);
      const low = t.toLowerCase(); // the small headings are drawn in capitals
      const at = ["Currency", "Ecash wallet", "Add ecash here before you ride.", "Cash out location", "Lightning wallet (NWC)"].map((w) => [w, low.indexOf(w.toLowerCase())]);
      for (const [w, i] of at) if (i < 0) throw new Error(`"${w}" is missing: ${t.slice(0, 400)}`);
      for (let i = 1; i < at.length; i++) if (at[i][1] < at[i - 1][1]) throw new Error(`"${at[i][0]}" comes before "${at[i - 1][0]}"`);
      if (/You pay your driver/.test(t)) throw new Error("the old wording is still there");
      await P.getByLabel("Local currency").waitFor({ timeout: 5000 });
      await P.getByLabel("Cash out location (Lightning address)").waitFor({ timeout: 5000 });
      await P.getByLabel("Nostr Wallet Connect string").waitFor({ timeout: 5000 });
      await P.getByLabel("Local currency").scrollIntoViewIfNeeded();
      await shot(P, `${role}-wallets-top`);
      await P.getByLabel("Nostr Wallet Connect string").scrollIntoViewIfNeeded();
      await shot(P, `${role}-wallets-bottom`);
    });
    await step(`${role}: Add funds and Send are side by side`, async () => {
      const add = await P.getByRole("button", { name: /Add funds/ }).first().boundingBox();
      const send = await P.getByRole("button", { name: "Send", exact: true }).boundingBox();
      if (!add || !send) throw new Error("a button is not on screen");
      if (Math.abs(add.y - send.y) > 6 || send.x <= add.x) throw new Error(`not side by side: add ${JSON.stringify(add)} send ${JSON.stringify(send)}`);
    });
  }

  await step("rider: On-chain tab gives a bitcoin address; a confirmed payment becomes ecash", async () => {
    await R.getByRole("button", { name: /Add funds/ }).first().click();
    await R.getByRole("tab", { name: "On-chain" }).click();
    const addr = R.getByLabel("Bitcoin address");
    await addr.waitFor({ timeout: 20000 });
    await shot(R, "rider-onchain");
    const text = (await addr.innerText()).trim();
    if (!/^bcrt1q/.test(text)) throw new Error("not an address from the mint: " + text);
    await sleep(1200);
    if (await R.getByText(/added/).count()) throw new Error("it says added before any payment");
    h.mint.depositOnchain(text, 4000);
    await R.getByRole("button", { name: "Check now" }).click();
    await R.getByText(/added/).waitFor({ timeout: 30000 });
    await R.getByRole("button", { name: "Done" }).click();
    const bal = await R.getByText("Balance").first().locator("..").innerText();
    if (!/4,000 sats/.test(bal)) throw new Error("expected 4,000 sats: " + bal.replace(/\s+/g, " "));
  });

  await step("rider: Send opens with the choice of an ecash token or a Lightning payment", async () => {
    await R.getByRole("button", { name: "Send", exact: true }).click();
    const dlg = R.getByRole("dialog");
    await dlg.waitFor({ timeout: 5000 });
    const t = (await dlg.innerText()).replace(/\s+/g, " ");
    if (!/token/i.test(t) || !/Lightning/i.test(t)) throw new Error("Send offers neither a token nor Lightning: " + t.slice(0, 300));
    await dlg.getByRole("button", { name: /Close|Cancel|✕|×/ }).first().click().catch(() => R.keyboard.press("Escape"));
  });

  await step("a cash out location saved in the rider app is the same in the driver app (same nsec)", async () => {
    const field = R.getByLabel("Cash out location (Lightning address)");
    await field.fill("shared@example.com");
    await field.press("Enter");
    await R.getByText("Saved", { exact: true }).first().waitFor({ timeout: 15000 });
    const other = await h.newContext("driver-same-key", metersNorth(PICKUP, 30));
    await lightningServer(other.ctx);
    await h.login(other.page, h.rider, h.driverUrl); // the RIDER's key, in the DRIVER app
    await tap(tabs(other.page).getByText("Account", { exact: true }));
    await openFold(other.page, "Wallets");
    const input = other.page.getByLabel("Cash out location (Lightning address)");
    for (let i = 0; i < 40 && (await input.inputValue()) !== "shared@example.com"; i++) await sleep(500);
    if ((await input.inputValue()) !== "shared@example.com") throw new Error("the driver app shows: " + (await input.inputValue()));
    await other.ctx.close();
  });

  await step("driver: up to 3 vehicle photos, only one is needed to drive", async () => {
    await openFold(D, "Vehicle & plate");
    const photos = D.locator('img[alt^="Vehicle photo"]');
    await photos.first().waitFor({ timeout: 10000 });
    if ((await photos.count()) !== 1) throw new Error("expected the 1 seeded photo, saw " + (await photos.count()));
    await D.getByLabel("Vehicle photo", { exact: true }).setInputFiles([PNG, PNG, PNG]);
    for (let i = 0; i < 40 && (await photos.count()) < 3; i++) await sleep(250);
    if ((await photos.count()) !== 3) throw new Error("expected 3 photos, saw " + (await photos.count()));
    if (await D.getByRole("button", { name: /Add photo/ }).count()) throw new Error("a 4th photo can be added");
    await photos.first().scrollIntoViewIfNeeded();
    await shot(D, "driver-vehicle-3-photos");
    await D.getByRole("button", { name: "Remove vehicle photo 2" }).click();
    if ((await photos.count()) !== 2) throw new Error("remove did not work");
    await D.getByRole("button", { name: /Add photo/ }).waitFor({ timeout: 3000 });
    await D.getByRole("button", { name: "Save vehicle info" }).click();
    await D.getByRole("button", { name: "Saved" }).waitFor({ timeout: 10000 });
    // The profile on the relay carries the main photo and the others (older apps read only the main one).
    await sleep(800);
    const me = h.driver.publicKey;
    const meta = h.relay.events.filter((e) => e.kind === 0 && e.pubkey === me).sort((a, b) => b.created_at - a.created_at)[0];
    const veh = JSON.parse(meta.content).vehicle;
    if (!veh.picture || !Array.isArray(veh.morePictures) || veh.morePictures.length !== 1) throw new Error("the profile does not carry 2 photos: " + JSON.stringify(Object.keys(veh)));
    if (!veh.sealedPlate || meta.content.includes("ABC123")) throw new Error("the plate must stay sealed");
    if (meta.content.length > 60000) throw new Error("the profile event is too big for many relays: " + meta.content.length);
    // None left: the driver cannot drive; one is enough.
    await D.getByRole("button", { name: "Remove vehicle photo 2" }).click();
    await D.getByRole("button", { name: "Remove vehicle photo 1" }).click();
    await D.getByRole("button", { name: "Save vehicle info" }).click();
    await D.getByText(/Still needed: .*Vehicle photo/).waitFor({ timeout: 10000 });
    await D.getByLabel("Vehicle photo", { exact: true }).setInputFiles([PNG]);
    await D.locator('img[alt="Vehicle photo 1"]').waitFor({ timeout: 10000 });
    await D.getByRole("button", { name: "Save vehicle info" }).click();
    await D.getByText("You're ready to drive.").waitFor({ timeout: 15000 });
  });

  for (const [role, P] of [["rider", R], ["driver", D]]) {
    await step(`${role}: Your vouches has the new wording`, async () => {
      await openFold(P, "Your vouches");
      await P.getByText("Add the npub of people you know and trust, whether they ride or drive. See the documentation to understand how they work.", { exact: true }).waitFor({ timeout: 5000 });
    });
  }

  const miss = [...(await h.missingStyles(R, "rider")), ...(await h.missingStyles(D, "driver"))].filter((c) => !/^leaflet/.test(c));
  log("class names on screen with no CSS rule:", miss.length ? miss.join(" ") : "none");
  log("errors:", h.errors.length ? h.errors : "none");
  ok = !h.errors.length;
} catch { log("RUN FAILED"); } finally { await h.stop(); }
process.exit(ok ? 0 : 1);
