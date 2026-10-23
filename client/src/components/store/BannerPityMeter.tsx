import { ShieldCheck } from 'lucide-react';

interface BannerPityMeterProps {
  misses: number;
  limit: number;
  guarantee: string;
  missLabel: string;
}

export default function BannerPityMeter({ misses, limit, guarantee, missLabel }: BannerPityMeterProps) {
  const safeMisses = Math.min(Math.max(0, limit - 1), Math.max(0, misses));
  const nextDraw = Math.min(limit, safeMisses + 1);
  const progress = limit > 0 ? (nextDraw / limit) * 100 : 100;
  const remainingDraws = Math.max(1, limit - safeMisses);

  return (
    <section aria-label="Garantia do banner" className="relative isolate overflow-hidden rounded-2xl border border-[#e9c94b]/25 bg-[linear-gradient(125deg,rgba(233,201,75,0.10),rgba(18,20,30,0.96)_48%,rgba(18,20,30,0.98))] p-3.5 shadow-[0_10px_28px_rgba(0,0,0,0.18)] sm:p-4">
      <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#e9c94b]/10 blur-2xl" />
      <div className="relative flex items-center gap-3">
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#e9c94b]/25 bg-[#e9c94b]/10 text-[#f0d45d]">
          <ShieldCheck size={18} strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-micro font-black uppercase tracking-kicker text-[#f0d45d]">Garantia do banner</h3>
          <p className="mt-1 text-xs font-semibold leading-snug text-[var(--ui-text)]">{guarantee}</p>
        </div>
      </div>
      <div
        role="progressbar"
        aria-label={`Próximo sorteio: ${nextDraw} de ${limit} até a garantia de ${missLabel}`}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={nextDraw}
        className="relative mt-3 h-2 overflow-hidden rounded-full bg-black/30 ring-1 ring-inset ring-white/[0.06]"
      >
        <div className="h-full rounded-full bg-gradient-to-r from-[#c8a932] via-[#f0d45d] to-[#fff0a3] shadow-[0_0_12px_rgba(233,201,75,0.35)] transition-[width] duration-500" style={{ width: `${progress}%` }} />
      </div>
      <div className="relative mt-2 flex items-center justify-between gap-2 text-micro">
        <p className={safeMisses >= limit - 1 ? 'font-bold text-[#f0d45d]' : 'text-[var(--ui-text-faint)]'}>
          {safeMisses >= limit - 1 ? 'Próximo sorteio garantido' : `Garantia em até ${remainingDraws} sorteios`}
        </p>
        <span className="shrink-0 font-bold tabular-nums text-[var(--ui-text-soft)]">Sorteio {nextDraw}/{limit}</span>
      </div>
    </section>
  );
}
