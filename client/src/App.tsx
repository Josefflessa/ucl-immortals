import { useEffect } from "react";
import GuestHeader from "./components/account/GuestHeader";
import { useChromeHidden } from "./lib/chrome";
import { music, musicZoneForPhase } from "./audio/musicPlayer";
import { warmAccountScreens, warmGameArt } from "./lib/appPrefetch";
import { Toaster } from "@/components/ui/sonner";
import { GameProvider, useGame } from "./contexts/GameContext";
import { AccountProvider, useAccount } from "./contexts/AccountContext";
import { AlbumProvider } from "./contexts/AlbumContext";
import AlbumGrantsPrompt from "./components/album/AlbumGrantsPrompt";
import ErrorBoundary from "./components/ErrorBoundary";
import InstallPrompt from "./components/InstallPrompt";
import MenuPage from "./pages/MenuPage";
import { createCompetitionFormat } from "@shared/game/competition";
import RoomInvitationPrompt from "./components/account/RoomInvitationPrompt";
import AccountHeader from "./components/account/AccountHeader";

// Every screen is imported statically on purpose: per-screen code-splitting
// showed an empty screen for a moment on every phase change, which
// happens all the time in a session (see commit 4b629b4).
import AlbumPage from "./pages/AlbumPage";
import StorePage from "./pages/StorePage";
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

const ACCOUNT_PAGE_PHASES = new Set(['menu', 'account', 'album', 'store', 'achievements', 'events']);

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
  const { account, loading: accountLoading } = useAccount();
  // Hooks stay above the early return below (their order must not change between renders).
  const chromeHidden = useChromeHidden();
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

  // Push links can be opened from a cold start or while another game phase is
  // visible. Route them to the account surface that can show the notification.
  useEffect(() => {
    if (!account || typeof window === 'undefined') return;
    const destination = new URLSearchParams(window.location.search).get('open');
    if (destination === 'notifications') {
      if (!ACCOUNT_PAGE_PHASES.has(state.phase)) dispatch({ type: 'SET_PHASE', phase: 'menu' });
    } else if (destination === 'friends' || destination === 'chat') {
      if (state.phase !== 'account') dispatch({ type: 'SET_PHASE', phase: 'account' });
      if (state.accountSection !== 'friends') dispatch({ type: 'SET_ACCOUNT_SECTION', section: 'friends' });
    }
  }, [account?.id, state.phase, state.accountSection, dispatch]);

  useEffect(() => {
    const onServiceWorkerMessage = (event: MessageEvent) => {
      const friendshipId = event.data?.type === 'friend-message' ? event.data.friendshipId : null;
      if (typeof friendshipId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(friendshipId)) return;
      const url = new URL(window.location.href);
      url.searchParams.set('open', 'chat');
      url.searchParams.set('friendship', friendshipId);
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      dispatch({ type: 'SET_ACCOUNT_SECTION', section: 'friends' });
      dispatch({ type: 'SET_PHASE', phase: 'account' });
    };
    navigator.serviceWorker?.addEventListener('message', onServiceWorkerMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onServiceWorkerMessage);
  }, [dispatch]);

  // The account mode has a fixed format. If an old back button or restored
  // state points at the guest-only format page, go straight to the difficulty.
  if (accountOnLegacySetup) return renderPhase('setup');

  const showAccountHeader = !!account && ACCOUNT_PAGE_PHASES.has(state.phase) && !chromeHidden;

  return (
    <>
      {showAccountHeader ? <AccountHeader /> : null}
      {!account && !accountLoading && state.phase === 'menu' ? <GuestHeader /> : null}
      {renderPhase(state.phase)}
    </>
  );
}

/** The account's exclusive cards feed its draft and Única pack offers in solo games. */
function EventCardsSync() {
  const { eventCards } = useAccount();
  const { state, dispatch } = useGame();
  const key = eventCards.join(',');
  useEffect(() => {
    if ((state.eventUniqueIds ?? []).join(',') !== key) dispatch({ type: 'SET_EVENT_UNIQUE_IDS', ids: key ? key.split(',') : [] });
  }, [key, state.eventUniqueIds, dispatch]);
  return null;
}

function renderPhase(phase: string) {
  switch (phase) {
    case 'menu':
    case 'lobby': return <MenuPage />;
    case 'account': return <AccountPage />;
    case 'album': return <AlbumPage />;
    case 'store': return <StorePage />;
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

/** Once the player is in, warms the store and the rest in the background (see appPrefetch). */
function AccountPrefetcher() {
  const { account } = useAccount();
  const accountId = account?.id ?? null;
  useEffect(() => (accountId ? warmAccountScreens() : undefined), [accountId]);
  // The art of the game itself is warmed for guests too.
  useEffect(() => warmGameArt(), []);
  return null;
}

/** The music follows the screen: the account side, the competition, or silence for the match. */
function MusicController() {
  const { state } = useGame();
  const zone = musicZoneForPhase(state.phase);
  useEffect(() => { music.setZone(zone); }, [zone]);
  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <Toaster />
      <AccountProvider>
        <AlbumProvider>
          <GameProvider>
            <ModalScrollLock />
            <EventCardsSync />
            <AccountPrefetcher />
            <MusicController />
            <GameRouter />
            <RoomInvitationPrompt />
            <InstallPrompt />
            <AlbumGrantsPrompt />
          </GameProvider>
        </AlbumProvider>
      </AccountProvider>
    </ErrorBoundary>
  );
}

export default App;
