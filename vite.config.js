import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// One repo, two separate apps. The Vite "mode" picks which one:
//   vite --mode rider    → apps/rider  (port 5173, builds to dist/rider)
//   vite --mode driver   → apps/driver (port 5174, builds to dist/driver)
// Both share the code in src/ (Nostr protocol, libs, UI kit); each has its
// own entry page, screens, and build output, so they deploy independently.
// `__APP_ROLE__` is replaced at build time (see src/config/app.js).
export default defineConfig(({ mode }) => {
  const role = mode === "driver" ? "driver" : "rider";
  return {
    root: `apps/${role}`,
    plugins: [react()],
    define: { __APP_ROLE__: JSON.stringify(role) },
    server: {
      port: role === "driver" ? 5174 : 5173,
      // The pages live in apps/<role> but import from the repo's src/.
      fs: { allow: [fileURLToPath(new URL(".", import.meta.url))] },
    },
    preview: { port: role === "driver" ? 4174 : 4173 },
    build: {
      outDir: `../../dist/${role}`,
      emptyOutDir: true,
      // The map library (Leaflet) is large; give it its own file so
      // it's cached separately and doesn't bloat the main bundle.
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            leaflet: ["leaflet"],
          },
        },
      },
    },
  };
});
