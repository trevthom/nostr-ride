import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { cspPlugin } from "./csp.mjs";

// "2026-10-12 21:30 UTC · 9dbe842": the build time, and the commit when git is available (a host without git shows only the time).
const buildId = () => {
  let sha = "";
  try { sha = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { /* no git here */ }
  return new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC" + (sha ? " · " + sha : "");
};

// One app: apps/nostrride (the entry pages) + src/ (the code). It has two faces, Ride and Drive, chosen at run time by a switch in
// the app (src/app/App.jsx); the role is NOT a build setting any more.
//   vite            → dev server on port 5173
//   vite build      → dist/nostrride  (static files; the pages use relative paths)
//   vite preview    → port 4173
// The app also ships the "follow a shared trip" page (track.html).
export default defineConfig(() => {
  return {
    root: "apps/nostrride",
    envDir: fileURLToPath(new URL(".", import.meta.url)), // .env lives at the repo root
    plugins: [react(), cspPlugin()],
    // Tailwind CSS v3 is built into the app's own CSS (src/tailwind.css); no script from a CDN runs in the page.
    css: { postcss: { plugins: [tailwindcss(fileURLToPath(new URL("./tailwind.config.js", import.meta.url))), autoprefixer()] } },
    define: { __BUILD_ID__: JSON.stringify(buildId()) },
    server: {
      port: 5173,
      // The pages live in apps/nostrride but import from the repo's src/.
      fs: { allow: [fileURLToPath(new URL(".", import.meta.url))] },
    },
    preview: { port: 4173 },
    build: {
      outDir: "../../dist/nostrride",
      emptyOutDir: true,
      // The map library (Leaflet) is large; give it its own file so
      // it's cached separately and doesn't bloat the main bundle.
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        input: {
          index: fileURLToPath(new URL("./apps/nostrride/index.html", import.meta.url)),
          track: fileURLToPath(new URL("./apps/nostrride/track.html", import.meta.url)),
        },
        output: {
          manualChunks: {
            leaflet: ["leaflet"],
          },
        },
      },
    },
  };
});
