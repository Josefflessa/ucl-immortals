import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeContext";
import { GameProvider, useGame } from "./contexts/GameContext";
import ErrorBoundary from "./components/ErrorBoundary";
import InstallPrompt from "./components/InstallPrompt";
import MenuPage from "./pages/MenuPage";
import AlbumPage from "./pages/AlbumPage";
import SetupPage from "./pages/SetupPage";
import TournamentFormatPage from "./pages/TournamentFormatPage";
import CrestPage from "./pages/CrestPage";
import CoachPage from "./pages/CoachPage";
import FormationPage from "./pages/FormationPage";
import DraftPage from "./pages/DraftPage";
import SquadReviewPage from "./pages/SquadReviewPage";
import LeaguePage from "./pages/LeaguePage";
import ReportPage from "./pages/ReportPage";
import MatchSimPage from "./pages/MatchSimPage";
// Pré-carrega a moldura + texturas das cartas uma vez (cacheia; evita "flash" na primeira carta).
['card-frame', 'bg-bronze', 'bg-prata', 'bg-ouro', 'bg-lendario', 'bg-imortal'].forEach((n) => {
  const img = new Image();
  img.src = `/cards/${n}.webp`;
});

// Modal aberto não pode deixar a página por baixo continuar rolando. O lock é
// centralizado aqui para cobrir tanto os modais do design system quanto os
// overlays legados que usam apenas `fixed inset-0`, sem bloquear o scroll
// interno do próprio modal.
const OPEN_MODAL_SELECTOR = '.ui-modal-backdrop, .fixed.inset-0, [role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]';

function ModalScrollLock() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPaddingRight: body.style.paddingRight,
    };
    // Modern browsers can reserve the scrollbar gutter even while overflow is
    // locked. When that is available, changing modal state no longer changes
    // the page width, so the shop grid does not need a forced repaint.
    const hasStableScrollbarGutter = typeof CSS !== 'undefined'
      && typeof CSS.supports === 'function'
      && CSS.supports('scrollbar-gutter: stable');
    let locked = false;

    const scrollbarCompensation = () => Math.max(0, window.innerWidth - html.clientWidth);

    const setLocked = (next: boolean) => {
      if (next === locked) return;
      locked = next;
      if (next) {
        // Keep the document in its normal flow. Fixing the body and restoring
        // it with window.scrollTo caused the whole home screen to repaint/
        // flash whenever a modal was closed. Keep a stable gutter when the
        // browser supports it; older browsers use the measured fallback.
        html.style.overflow = 'hidden';
        body.style.overflow = 'hidden';
        if (hasStableScrollbarGutter) {
          body.style.paddingRight = previous.bodyPaddingRight;
        } else {
          const currentPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;
          const scrollbarWidth = scrollbarCompensation();
          body.style.paddingRight = scrollbarWidth > 0
            ? `${currentPaddingRight + scrollbarWidth}px`
            : previous.bodyPaddingRight;
        }
        return;
      }
      html.style.overflow = previous.htmlOverflow;
      body.style.overflow = previous.bodyOverflow;
      body.style.paddingRight = previous.bodyPaddingRight;
    };

    const update = () => setLocked(document.querySelector(OPEN_MODAL_SELECTOR) !== null);
    const observer = new MutationObserver(update);
    update();
    observer.observe(body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-state'] });

    return () => {
      observer.disconnect();
      setLocked(false);
    };
  }, []);

  return null;
}

function GameRouter() {
  const { state } = useGame();

  // Cada "página" é uma fase (state.phase). Ao trocar de fase, a janela mantinha o
  // scroll da fase anterior (ex.: rolou lá no fim do Escudo → o Treinador abria no meio).
  // Volta ao topo sempre que a fase muda, pra cada etapa começar do começo.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [state.phase]);

  switch (state.phase) {
    case 'menu':
    case 'lobby': return <MenuPage />;
    case 'album': return <AlbumPage />;
    case 'format': return <TournamentFormatPage />;
    case 'setup': return <SetupPage />;
    case 'crest': return <CrestPage />;
    case 'coach': return <CoachPage />;
    case 'formation': return <FormationPage />;
    case 'draft': return <DraftPage />;
    case 'squad_review': return <SquadReviewPage />;
    // Both phases share the same season hub (rounds/standings vs ties/bracket).
    case 'league':
    case 'knockout': return <LeaguePage />;
    case 'match_sim': return <MatchSimPage />;
    case 'report': return <ReportPage />;
    default: return <MenuPage />;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <GameProvider>
            <ModalScrollLock />
            <GameRouter />
            <InstallPrompt />
          </GameProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
