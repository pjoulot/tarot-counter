import type { CapacitorConfig } from "@capacitor/cli";

// appId is permanent once the app is on the Play Store: change it before the first upload if you want another one.
const config: CapacitorConfig = {
  appId: "fr.philippejoulot.tarotcounter",
  appName: "Tarot Points",
  webDir: "dist",
  backgroundColor: "#FFF6EA",
  android: { backgroundColor: "#FFF6EA" },
  plugins: { SystemBars: { insetsHandling: "css", initialViewportFitValueHint: "cover" } },
};

export default config;
