import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installUiSounds } from "./audio/uiSound";

// Dev-only pitch gallery (#lances). `import.meta.env.DEV` is false in production
// builds, so this branch and its chunk are removed entirely.
if (import.meta.env.DEV && location.hash === "#lances") {
  void import("./pages/dev/PitchGalleryPage").then(({ default: PitchGalleryPage }) => {
    createRoot(document.getElementById("root")!).render(<PitchGalleryPage />);
  });
} else if (import.meta.env.DEV && location.hash === "#gacha") {
  // Dev-only: play the banner reveal with made-up draws, every rarity, 1 and 10 cards.
  void import("./pages/dev/GachaPreviewPage").then(({ default: GachaPreviewPage }) => {
    createRoot(document.getElementById("root")!).render(<GachaPreviewPage />);
  });
} else if (import.meta.env.DEV && location.hash === "#sons") {
  // Dev-only: hear the match sound options side by side.
  installUiSounds();
  void import("./pages/dev/SoundsPage").then(({ default: SoundsPage }) => {
    createRoot(document.getElementById("root")!).render(<SoundsPage />);
  });
} else if (import.meta.env.DEV && location.hash.startsWith("#partida")) {
  // Dev-only: a whole match on generated teams, outside any campaign (#partida, #partida-penaltis).
  void import("./pages/dev/MatchHarnessPage").then(({ default: MatchHarnessPage }) => {
    createRoot(document.getElementById("root")!).render(<MatchHarnessPage penalties={location.hash === "#partida-penaltis"} />);
  });
} else {
  installUiSounds();
  createRoot(document.getElementById("root")!).render(<App />);
}

// PWA: register the service worker (enables "install to home screen"). Best-effort; never blocks the app.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
