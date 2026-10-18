import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installUiSounds } from "./audio/uiSound";
import { getAudioContext } from "./audio/audioCore";
import { soundSettings } from "./audio/soundSettings";

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

// The opening screen in index.html stays until the app has drawn its first frame. If the music is on and the
// browser has not allowed sound yet, it then turns into an "Entrar" button: that tap is the one the browser needs,
// so the game opens with the music already playing. Otherwise it simply fades out.
(function runSplash() {
  const splash = document.getElementById("splash");
  if (!splash) return;
  const finish = () => {
    splash.classList.add("splash--out");
    setTimeout(() => splash.remove(), 450);
  };
  const started = performance.now();
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => {
    const enter = document.getElementById("splash-enter") as HTMLButtonElement | null;
    const context = getAudioContext();
    const needsTap = !!enter && !!context && context.state !== "running" && !soundSettings.get().musicMuted
      && !(import.meta.env.DEV && location.hash);
    if (!needsTap) { finish(); return; }
    splash.classList.add("splash--ready");
    enter!.tabIndex = 0;
    enter!.focus({ preventScroll: true });
    enter!.addEventListener("click", () => { void context!.resume().catch(() => undefined); finish(); }, { once: true });
  }, Math.max(0, 450 - (performance.now() - started)))));
})();
