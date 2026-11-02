import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Relative paths: the same build works at a web root, in a sub-folder, and inside the Android app.
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false, // registered in main.tsx, web only (the Android app has its files locally)
      includeAssets: ["favicon.png", "apple-touch-icon.png", "avatars/*.webp", "art/*.webp"],
      manifest: {
        name: "Tarot : compteur de points",
        short_name: "Tarot Points",
        description: "Comptez vos parties de tarot, sans calculette.",
        lang: "fr",
        theme_color: "#FFF6EA",
        background_color: "#FFF6EA",
        display: "standalone",
        orientation: "portrait",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: { globPatterns: ["**/*.{js,css,html,webp,png,woff2}"] },
    }),
  ],
  server: { host: true, port: 5174 },
});
