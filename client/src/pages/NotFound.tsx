import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";
import { AppShell, Button, Panel } from '../design-system';

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <AppShell className="flex min-h-dvh w-full items-center justify-center">
      <Panel className="mx-4 w-full max-w-lg p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-red-100 rounded-full animate-pulse" />
              <AlertCircle className="relative h-16 w-16 text-red-500" />
            </div>
          </div>

          <h1 className="mb-2 font-display text-5xl text-[var(--ui-brand-strong)]">404</h1>

          <h2 className="mb-4 font-display text-2xl tracking-wider text-[var(--ui-text)]">
            Página não encontrada
          </h2>

          <p className="mb-8 leading-relaxed text-[var(--ui-text-muted)]">
            A página que você procura não existe.
            <br />
            Ela pode ter sido movida ou removida.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button intent="primary"
              onClick={handleGoHome}
            >
              <Home className="w-4 h-4 mr-2" />
              Voltar ao início
            </Button>
          </div>
      </Panel>
    </AppShell>
  );
}
