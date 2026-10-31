// ════════════════════════════════════════════════════════════
//  EXPORT APPS — Makes the rider app and the driver app into two standalone
//  projects (each with its own package.json, build and tests) from this
//  repository, and can push them to their own GitHub repositories.
//
//  This repository stays the SOURCE OF TRUTH. The two exported repositories
//  are generated copies: change the code HERE, then run this script again.
//  (A hand edit in an exported repo is overwritten by the next export.)
//
//  The generated apps have ONE face each (no Ride / Drive switch): each gets
//  its own src/app/App.jsx that mounts only its role and its own three tabs.
//
//  Usage:
//    node scripts/export-apps.mjs                       # export to ../nostr-ride-export
//    node scripts/export-apps.mjs --out /some/folder    # export somewhere else
//    node scripts/export-apps.mjs --push                # also push to GitHub (main)
//    node scripts/export-apps.mjs --push --owner me     # GitHub owner (default: trevthom)
//    node scripts/export-apps.mjs --only rider          # one app only
//  Repository names: nostr-ride-rider and nostr-ride-driver.
// ════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const OUT = path.resolve(opt("--out", path.join(SRC, "..", "nostr-ride-export")));
const OWNER = opt("--owner", "trevthom");
const PUSH = args.includes("--push");
const ROLES = opt("--only") ? [opt("--only")] : ["rider", "driver"];

const SOURCE_COMMIT = (() => { try { return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: SRC, stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || "unknown"; } catch { return "unknown"; } })();
const read = (p) => fs.readFileSync(p, "utf8");
const write = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
const skip = (p) => /(^|[\\/])(node_modules|dist|artifacts|\.git|\.DS_Store)([\\/]|$)/.test(p);
const copy = (from, to) => fs.cpSync(from, to, { recursive: true, filter: (p) => !skip(p) });

const DESC = {
  rider: 'Uber/Lyft-style: "Where to?", fare quote, find a driver, watch the car arrive, start with a 4-digit code (the driver shows it, the rider types it), pay the driver in ecash as the ride runs, finish the ride.',
  driver: "Uber-Driver-style: GO online, incoming request cards, accept, navigate to pickup, arrive (within 150 m) / start code / finish the ride, ecash earnings.",
};
const GENERATED = (role) =>
  `> **Generated repository.** This is a copy of the ${role} app made from **${OWNER}/nostr-ride** at \`${SOURCE_COMMIT}\` by \`scripts/export-apps.mjs\`. Make changes in nostr-ride and export again: a hand edit here is overwritten by the next export.\n`;

function riderApp() {
  return `// ════════════════════════════════════════════════════════════
//  RIDER APP — generated from nostr-ride. One face only: the three rider tabs.
//  Everything shared (key, profile, wallet, settings) is in AppProvider.
// ════════════════════════════════════════════════════════════

import { AppProvider, useApp } from "../state/AppContext.jsx";
import { RiderProvider, useRider } from "../rider/state/RiderContext.jsx";
import { AppFrame, TabBar } from "../ui/Layout.jsx";
import ErrorBoundary from "../ui/ErrorBoundary.jsx";
import UserModal from "../ui/UserModal.jsx";
import NoticeBanner from "../ui/NoticeBanner.jsx";
import ConnectionBanner from "../ui/ConnectionBanner.jsx";
import AuthScreen from "../features/auth/AuthScreen.jsx";
import HomeScreen from "../rider/screens/HomeScreen.jsx";
import ActivityScreen from "../rider/screens/ActivityScreen.jsx";
import AccountScreen from "../rider/screens/AccountScreen.jsx";
import { setAppRole } from "../config/app.js";
import { viewFor } from "../lib/mode.js";

setAppRole("rider");

const SCREENS = { home: HomeScreen, activity: ActivityScreen, account: AccountScreen };
const TABS = [
  { id: "home", label: "Ride", icon: "car" },
  { id: "activity", label: "Activity", icon: "clock" },
  { id: "account", label: "Account", icon: "user" },
];

function Shell() {
  const { view, setView } = useApp();
  const { activeRide, receipt, plan, resetPlan } = useRider();
  const shown = viewFor("ride", view);
  const Screen = SCREENS[shown];
  const onTab = (id) => {
    if (id === "home" && shown === "home" && !activeRide && !receipt && plan.step !== "idle") resetPlan();
    else setView(id);
  };
  return (
    <AppFrame>
      <ErrorBoundary resetKey={shown}>
        <Screen />
      </ErrorBoundary>
      <TabBar items={TABS} active={shown} onChange={onTab} />
      <UserModal />
      <ConnectionBanner />
      <NoticeBanner />
    </AppFrame>
  );
}

function Gate() {
  const { user, setUser } = useApp();
  if (!user) return <AuthScreen onLogin={setUser} />;
  return (
    <RiderProvider key={user.publicKey}>
      <Shell />
    </RiderProvider>
  );
}

export default function RiderApp() {
  return (
    <AppProvider initialView="home">
      <Gate />
    </AppProvider>
  );
}
`;
}

function driverApp() {
  return `// ════════════════════════════════════════════════════════════
//  DRIVER APP — generated from nostr-ride. One face only: the three driver tabs.
//  Everything shared (key, profile, wallet, settings) is in AppProvider.
// ════════════════════════════════════════════════════════════

import { AppProvider, useApp } from "../state/AppContext.jsx";
import { DriverProvider, useDriver } from "../driver/state/DriverContext.jsx";
import { AppFrame, TabBar } from "../ui/Layout.jsx";
import ErrorBoundary from "../ui/ErrorBoundary.jsx";
import UserModal from "../ui/UserModal.jsx";
import NoticeBanner from "../ui/NoticeBanner.jsx";
import ConnectionBanner from "../ui/ConnectionBanner.jsx";
import AuthScreen from "../features/auth/AuthScreen.jsx";
import HomeScreen from "../driver/screens/HomeScreen.jsx";
import EarningsScreen from "../driver/screens/EarningsScreen.jsx";
import AccountScreen from "../driver/screens/AccountScreen.jsx";
import { setAppRole } from "../config/app.js";
import { viewFor } from "../lib/mode.js";

setAppRole("driver");

const SCREENS = { drive: HomeScreen, earnings: EarningsScreen, account: AccountScreen };

function Shell() {
  const { view, setView } = useApp();
  const { open, online, alerts } = useDriver();
  const shown = viewFor("drive", view);
  const Screen = SCREENS[shown];
  const tabs = [
    { id: "drive", label: "Drive", icon: "car", badge: online && (shown !== "drive" || !alerts) ? open.length : 0 },
    { id: "earnings", label: "Earnings", icon: "chart" },
    { id: "account", label: "Account", icon: "user" },
  ];
  return (
    <AppFrame>
      <ErrorBoundary resetKey={shown}>
        <Screen />
      </ErrorBoundary>
      <TabBar items={tabs} active={shown} onChange={setView} />
      <UserModal />
      <ConnectionBanner />
      <NoticeBanner />
    </AppFrame>
  );
}

function Gate() {
  const { user, setUser } = useApp();
  if (!user) return <AuthScreen onLogin={setUser} />;
  return (
    <DriverProvider key={user.publicKey}>
      <Shell />
    </DriverProvider>
  );
}

export default function DriverApp() {
  return (
    <AppProvider initialView="drive">
      <Gate />
    </AppProvider>
  );
}
`;
}

function readme(role, other, port) {
  const name = role === "rider" ? "Rider" : "Driver";
  return `# NostrRide ${name} app 🚗⚡

The **${role}** half of NostrRide, a decentralized ridesharing system on **Nostr**. The rider pays the driver in **ecash** (Cashu)
as the ride runs. There is no central server and no database. ${DESC[role]}

The other half is in its own repository: **nostr-ride-${other}**. The two apps only talk through Nostr relays,
so they can be deployed separately.

${GENERATED(role)}
## Run it
\`\`\`bash
npm install
npm run dev     # http://localhost:${port}
npm test        # automated checks
npm run build   # static site in dist/
\`\`\`
Needs Node.js 22.23.4+ (or 24.22.1+ on the 24 line) and internet (fonts, map, relays). Location needs \`https://\` or \`localhost\`.
To try a whole ride, run both apps and sign in with a different account in each.

## Docs
- [\`docs/index.md\`](docs/index.md): how it works, events, privacy, payments, safety, deploying, self-hosting maps.
- [\`CLAUDE.md\`](CLAUDE.md): the file map and the rules.
- \`env.example\`: use your own map, search and routing servers.
${role === "driver" ? "- `native/`: Capacitor shell for background GPS.\n" : ""}`;
}

function claudeMd(role, other, port) {
  const name = role === "rider" ? "Rider" : "Driver";
  return `# NostrRide ${name} app

${GENERATED(role)}
This repository is the **${role}** half of NostrRide. The **${other}** app is **nostr-ride-${other}**.
The apps share no server: they find each other through Nostr relays and use the same event formats.

## Commands
- \`npm install\` then \`npm run dev\` → http://localhost:${port}
- \`npm test\` → Node's built-in test runner over \`test/*.test.mjs\` (no extra deps)
- \`npm run build\` → \`dist/\` (static files; relative paths)
- No linter configured.

## Shape
- \`main.jsx\`, \`index.html\` — the entry page.${role === "rider" ? " `track.html`/`track.jsx` — the page that follows a shared trip." : ""}
- \`src/app/App.jsx\` — generated single-face shell: one role provider and its three tabs.
- \`src/state/AppContext.jsx\` — the shared key, profile, wallet, relays and settings.
- \`src/${role}/\` — this app's screens and state.
- \`src/features/\`, \`src/lib/\`, \`src/nostr/\`, \`src/ui/\` — shared code.

## Rules
- **Do not develop here.** Change ${OWNER}/nostr-ride and run \`node scripts/export-apps.mjs --only ${role}\` there.
- The role is fixed by the generated \`src/app/App.jsx\`; there is no Ride / Drive switch.
- Never publish an exact address, a plate or a key in clear; read \`docs/index.md\` before touching money or privacy.
`;
}

function docsMd(role, other) {
  let t = read(path.join(SRC, "docs", "index.md"));
  const name = role === "rider" ? "Rider" : "Driver";
  t = t.replace(/^# .*$/m, `# NostrRide ${name} app documentation

${GENERATED(role)}
> This copy is the **${role}** app. The **${other}** app is in **nostr-ride-${other}**; both speak the same events.
> In this copy \`npm run build\` writes \`dist/\` (the shared repo uses \`dist/nostrride\`), and there is no Ride / Drive switch.`);
  return t;
}

// The exported project has index.html (and track.html) at its root, so the scan paths differ from the main repo's.
// Everything else (the dark-mode color variables, darkMode: "class") is taken from the main repo's tailwind.config.js, so the two cannot drift apart.
function tailwindConfig() {
  const main = read(path.join(SRC, "tailwind.config.js"));
  const content = /^  content: \[.*\],$/m;
  if (!content.test(main)) throw new Error("export: the content line of tailwind.config.js was not found");
  const line = "  content: [`${root}/*.html`, `${root}/src/**/*.{js,jsx}`],";
  return main.replace(content, line);
}

function viteConfig(role, port) {
  const input = role === "rider"
    ? `      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
        track: fileURLToPath(new URL("./track.html", import.meta.url)),
      },`
    : `      input: { index: fileURLToPath(new URL("./index.html", import.meta.url)) },`;
  return `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { cspPlugin } from "./csp.mjs";

// "2026-10-12 21:30 UTC · from nostr-ride ${SOURCE_COMMIT}": the build time and the source commit (shown in Account).
const buildId = () => new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC · from nostr-ride ${SOURCE_COMMIT}";

// The ${role} app of NostrRide, as its own project (generated; see scripts/export-apps.mjs in nostr-ride).
// One face only: src/app/App.jsx mounts the ${role} shell. base "./" lets the built files work from any sub-path.
export default defineConfig({
  base: "./",
  envDir: ".",
  plugins: [react(), cspPlugin()],
  css: { postcss: { plugins: [tailwindcss(fileURLToPath(new URL("./tailwind.config.js", import.meta.url))), autoprefixer()] } },
  define: { __BUILD_ID__: JSON.stringify(buildId()) },
  server: { port: ${port} },
  preview: { port: ${port - 1000} },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
${input}
      output: { manualChunks: { leaflet: ["leaflet"] } },
    },
  },
});
`;
}

function exportOne(role) {
  if (role !== "rider" && role !== "driver") throw new Error(`export: unknown role ${role}`);
  const other = role === "rider" ? "driver" : "rider";
  const port = role === "rider" ? 5173 : 5174;
  const d = path.join(OUT, `nostr-ride-${role}`);

  // Start clean but keep .git (so a push is a commit on top of the last export) and .github (the sync workflow).
  fs.mkdirSync(d, { recursive: true });
  for (const f of fs.readdirSync(d)) if (f !== ".git" && f !== ".github") fs.rmSync(path.join(d, f), { recursive: true, force: true });

  copy(path.join(SRC, "src"), path.join(d, "src"));
  fs.rmSync(path.join(d, "src", other), { recursive: true, force: true }); // this app has one face
  write(path.join(d, "src", "app", "App.jsx"), role === "rider" ? riderApp() : driverApp());
  copy(path.join(SRC, "test"), path.join(d, "test"));
  copy(path.join(SRC, "apps", "nostrride", "public"), path.join(d, "public"));

  // The entry pages live at the repo root in an exported app.
  const entries = role === "rider" ? ["index.html", "main.jsx", "track.html", "track.jsx"] : ["index.html", "main.jsx"];
  for (const f of entries) {
    let s = read(path.join(SRC, "apps", "nostrride", f)).replaceAll("../../src/", "./src/");
    if (f.endsWith(".html")) s = s.replaceAll('href="/', 'href="./').replaceAll('src="/', 'src="./');
    write(path.join(d, f), s);
  }

  for (const f of ["env.example", ".gitignore"]) fs.copyFileSync(path.join(SRC, f), path.join(d, f));
  if (fs.existsSync(path.join(SRC, "LICENSE"))) fs.copyFileSync(path.join(SRC, "LICENSE"), path.join(d, "LICENSE"));
  write(path.join(d, "csp.mjs"), read(path.join(SRC, "csp.mjs")).replaceAll("apps/nostrride/main.jsx", "main.jsx"));

  const pk = JSON.parse(read(path.join(SRC, "package.json")));
  pk.name = `nostr-ride-${role}`;
  pk.scripts = { dev: "vite", build: "vite build", preview: "vite preview", test: 'node --test "test/*.test.mjs"' };
  write(path.join(d, "package.json"), JSON.stringify(pk, null, 2) + "\n");
  const lock = JSON.parse(read(path.join(SRC, "package-lock.json")));
  lock.name = pk.name;
  if (lock.packages?.[""]) lock.packages[""].name = pk.name;
  write(path.join(d, "package-lock.json"), JSON.stringify(lock, null, 2) + "\n");

  write(path.join(d, "vite.config.js"), viteConfig(role, port));
  write(path.join(d, "tailwind.config.js"), tailwindConfig());
  write(path.join(d, "CLAUDE.md"), claudeMd(role, other, port));
  write(path.join(d, "docs", "index.md"), docsMd(role, other));
  write(path.join(d, "README.md"), readme(role, other, port));

  if (role === "driver") {
    copy(path.join(SRC, "native"), path.join(d, "native"));
    const cfgPath = path.join(d, "native", "capacitor.config.json");
    write(cfgPath, JSON.stringify({ ...JSON.parse(read(cfgPath)), webDir: "../dist" }, null, 2) + "\n");
    const np = path.join(d, "native", "package.json");
    const nativePkg = JSON.parse(read(np));
    nativePkg.description = "Native shells (iOS and Android) for the NostrRide driver app: background GPS and a page that keeps working with the phone locked.";
    write(np, JSON.stringify(nativePkg, null, 2) + "\n");
    const nr = path.join(d, "native", "README.md");
    write(nr, read(nr).replaceAll("../dist/nostrride", "../dist"));
  }
  return d;
}

const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();

function push(role, d) {
  const url = `https://github.com/${OWNER}/nostr-ride-${role}`;
  if (!fs.existsSync(path.join(d, ".git"))) { git(d, "init", "-q", "-b", "main"); git(d, "remote", "add", "origin", url); }
  try { git(d, "fetch", "-q", "origin", "main"); git(d, "reset", "-q", "--soft", "origin/main"); } catch { /* first push: the repository is empty */ }
  git(d, "add", "-A");
  if (!git(d, "status", "--porcelain")) { console.log(`${role}: nothing changed`); return; }
  const rev = git(SRC, "rev-parse", "--short", "HEAD");
  git(d, "commit", "-q", "-m", `Export from ${OWNER}/nostr-ride @ ${rev}\n\nGenerated by scripts/export-apps.mjs. Change the code in nostr-ride, not here.`);
  git(d, "push", "-q", "origin", "HEAD:main");
  console.log(`${role}: pushed to ${url} (main)`);
}

for (const role of ROLES) {
  const d = exportOne(role);
  console.log(`${role}: exported to ${d}`);
  if (PUSH) push(role, d);
}
