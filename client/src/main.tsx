import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

let splashHidden = false;

function hideSplash() {
  if (splashHidden) return;
  splashHidden = true;
  const splash = document.getElementById("splash-screen");
  if (splash) {
    splash.classList.add("splash-hidden");
    setTimeout(() => splash.remove(), 350);
  }
}

// Safety timeout so splash does not block first-time visitors on slow auth/network.
window.setTimeout(hideSplash, 1600);
// Absolute fail-safe: never leave users stuck behind splash if any runtime error occurs.
window.addEventListener("error", () => hideSplash());
window.addEventListener("unhandledrejection", () => hideSplash());
window.setTimeout(hideSplash, 10000);

createRoot(document.getElementById("root")!).render(<App onReady={hideSplash} />);
