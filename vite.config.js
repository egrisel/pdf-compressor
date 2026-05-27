import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ["pdf-compressor.e-grisel.net"],
    host: "0.0.0.0",
    port: 3350
  },
  build: {
    outDir: "dist"
  }
});

