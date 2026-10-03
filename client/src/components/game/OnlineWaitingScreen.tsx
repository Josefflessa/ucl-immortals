import { AppShell, TopBar } from '../../design-system';
import type { ReactNode } from 'react';

interface OnlineWaitingScreenProps {
  message: string;
  detail?: string;
  headerRight?: ReactNode;
}

export default function OnlineWaitingScreen({ message, detail = 'A partida continua sincronizada para todos.', headerRight }: OnlineWaitingScreenProps) {
  return (
    <AppShell className="relative flex min-h-dvh flex-col overflow-hidden">
      <TopBar right={headerRight} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 38%, rgba(201,168,76,0.10), transparent 28%), linear-gradient(180deg, #090A12 0%, var(--ui-bg) 100%)',
        }}
      />

      <div className="relative flex min-h-[calc(100dvh-64px)] w-full flex-col items-center justify-center px-5 text-center">
        <div className="flex w-full max-w-sm flex-col items-center">
          <div
            className="flex h-24 w-24 items-center justify-center rounded-full border border-primary/33 bg-[#10101D] shadow-[0_0_42px_rgba(201,168,76,0.12)]"
          >
            <img
              src="/icons/logo_ucl.png"
              alt="UCL Immortals"
              className="h-16 w-16 object-contain"
            />
          </div>

          <div className="mt-7 flex items-center gap-2 text-[12px] font-bold tracking-[0.24em] text-primary" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E] shadow-[0_0_8px_rgba(34,197,94,0.8)]" aria-hidden="true" />
            PARTIDA ONLINE
          </div>

          <div className="mt-4 h-1 w-14 overflow-hidden rounded-full bg-[#1C1C2B]" aria-hidden="true">
            <div className="h-full w-1/2 animate-[waiting-progress_1.5s_ease-in-out_infinite] rounded-full bg-primary" />
          </div>

          <h1 className="mt-7 max-w-xs text-2xl font-bold leading-tight text-[#F5F5FA]" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
            Aguardando a sala
          </h1>
          <p className="mt-2 max-w-xs text-base font-semibold leading-snug text-[#D4D4E0]" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
            {message}
          </p>
          <p className="mt-4 max-w-[17rem] text-xs leading-relaxed text-[#77778A]" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
            {detail}
          </p>
        </div>
      </div>
    </AppShell>
  );
}
