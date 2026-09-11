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
            <GameRouter />
            <InstallPrompt />
          </GameProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
