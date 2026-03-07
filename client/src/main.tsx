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

createRoot(document.getElementById("root")!).render(<App onReady={hideSplash} />);
