import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// This file tells Vite (the dev server) how to build the app.
// You almost never need to touch this.
export default defineConfig({
  plugins: [react()],
  build: {
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
});
