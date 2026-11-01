import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/fredoka/500.css";
import "@fontsource/fredoka/600.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "./styles.css";
import { App } from "./App";
import { isNative, setupBackButton } from "./native";

void setupBackButton();
if (!isNative && "serviceWorker" in navigator) {
  void import("virtual:pwa-register").then(({ registerSW }) => registerSW({ immediate: true, onRegisterError: () => undefined })).catch(() => undefined);
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<StrictMode><App /></StrictMode>);
