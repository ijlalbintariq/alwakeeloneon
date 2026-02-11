import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

function hideSplash() {
  const splash = document.getElementById("splash-screen");
  if (splash) {
    splash.classList.add("splash-hidden");
    setTimeout(() => splash.remove(), 700);
  }
}

createRoot(document.getElementById("root")!).render(<App onReady={hideSplash} />);
