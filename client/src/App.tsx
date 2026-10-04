import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { GameProvider, useGame } from "./contexts/GameContext";
import { AccountProvider, useAccount } from "./contexts/AccountContext";
import ErrorBoundary from "./components/ErrorBoundary";
import InstallPrompt from "./components/InstallPrompt";
import MenuPage from "./pages/MenuPage";
import { createCompetitionFormat } from "@shared/game/competition";
import RoomInvitationPrompt from "./components/account/RoomInvitationPrompt";

// Every screen is imported statically on purpose: per-screen code-splitting
// showed an empty screen for a moment on every phase change, which
// happens all the time in a session (see commit 4b629b4).
import AlbumPage from "./pages/AlbumPage";
import AchievementsPage from "./pages/AchievementsPage";
import EventsPage from "./pages/EventsPage";
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
import AccountPage from "./pages/AccountPage";

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
  const { state, dispatch } = useGame();
  const { account } = useAccount();
  // Accounts play a fixed format but choose the difficulty (the 'setup' page).
  const accountOnLegacySetup = !!account && state.phase === 'format';

  // Cada "página" é uma fase (state.phase). Ao trocar de fase, a janela mantinha o
  // scroll da fase anterior (ex.: rolou lá no fim do Escudo → o Treinador abria no meio).
  // Volta ao topo sempre que a fase muda, pra cada etapa começar do começo.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [state.phase]);

  useEffect(() => {
    if (!accountOnLegacySetup) return;
    dispatch({ type: 'SET_COMPETITION_FORMAT', format: createCompetitionFormat('league_knockout') });
    dispatch({ type: 'SET_PHASE', phase: 'setup' });
  }, [accountOnLegacySetup, dispatch]);

  // The account mode has a fixed format. If an old back button or restored
  // state points at the guest-only format page, go straight to the difficulty.
  if (accountOnLegacySetup) return renderPhase('setup');

  return renderPhase(state.phase);
}

function renderPhase(phase: string) {
  switch (phase) {
    case 'menu':
    case 'lobby': return <MenuPage />;
    case 'account': return <AccountPage />;
    case 'album': return <AlbumPage />;
    case 'achievements': return <AchievementsPage />;
    case 'events': return <EventsPage />;
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
      <Toaster />
      <AccountProvider>
        <GameProvider>
          <ModalScrollLock />
          <GameRouter />
          <RoomInvitationPrompt />
          <InstallPrompt />
        </GameProvider>
      </AccountProvider>
    </ErrorBoundary>
  );
}

export default App;
