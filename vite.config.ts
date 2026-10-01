/// <reference types="vitest" />

import tailwindcss from "@tailwindcss/vite";
import legacy from "@vitejs/plugin-legacy";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/quantified-habit-tracker/",
  plugins: [
    react(),
    legacy(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        id: "/quantified-habit-tracker/",
        name: "Quantified Habit Tracker",
        short_name: "QHT",
        description: "An installable, native-like app built with React and Ionic",
        theme_color: "#3880ff",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/quantified-habit-tracker/",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
      scope: "/quantified-habit-tracker/",
      base: "/quantified-habit-tracker/",
    }),
  ],
  build: {
    outDir: "dist",
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
  },
});
