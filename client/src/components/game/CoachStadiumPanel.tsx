import { useState } from 'react';
import { Coach, Formation } from '../../lib/gameData';
import { stadiumDisplayFor, stadiumFor } from '../../lib/stadium';
import { PRIME_COST, PRIME_WINS_REQUIRED } from '../../lib/shop';
import { coachPrimeDefinition } from '../../lib/coachPrime';
import CoachCard from './CoachCard';
import { Button } from '../../design-system';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';


interface Props {
  coach: Coach;
  formation?: Formation;
  coachPrime: boolean;
  stadiumProjectLevel?: number;
  wins?: number;
  points?: number;
  onEvolve?: () => void; // presente só no MEU TIME (editável); ausente = só exibição
  reportSummary?: boolean; // resumo enxuto usado exclusivamente no resultado final
}

function ProgressRequirement({ label, current, target }: { label: string; current: number; target: number }) {
  const complete = current >= target;
  const progress = Math.min(100, Math.round((current / target) * 100));

  return (
    <div className="rounded-xl border border-[#24243A] bg-[#0A0A14] px-3 py-2.5" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black" style={{ color: complete ? '#04120A' : '#FCA5A5', background: complete ? '#4ADE80' : '#EF444422', border: complete ? 'none' : '1px solid #EF444466' }}>
            {complete ? '✓' : '×'}
          </span>
          <span className="truncate text-xs font-bold text-[#C9C9D5]">{label}</span>
        </div>
        <strong className="shrink-0 text-xs font-black" style={{ color: complete ? '#4ADE80' : '#FCA5A5' }}>
          {current}/{target}
        </strong>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#24243A]">
        <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: complete ? '#22C55E' : '#E8C84A' }} />
      </div>
    </div>
  );
}

// Uma linha de transição "antes → depois" com fotos.
function TransitionRow({ before, after }: { before: React.ReactNode; after: React.ReactNode }) {
  return (
    <div className="grid min-w-0 shrink-0 grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)] items-center gap-2 py-1">
      <div className="flex min-w-0 items-center justify-center">{before}</div>
      <div className="flex size-8 items-center justify-center rounded-full border border-[#C9A84C66] bg-[#C9A84C18] text-lg font-black text-[#E8C84A]" aria-hidden="true">→</div>
      <div className="flex min-w-0 items-center justify-center">{after}</div>
      </div>
  );
}

// Exibição do técnico. O estádio é uma seção independente em "Meu Clube".
export default function CoachStadiumPanel({ coach, formation, coachPrime, stadiumProjectLevel = 1, wins = 0, points = 0, onEvolve, reportSummary = false }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [reportStadiumImgOk, setReportStadiumImgOk] = useState(true);
  const canEvolve = wins >= PRIME_WINS_REQUIRED && points >= PRIME_COST;
  const primeDefinition = coachPrimeDefinition(coach.id);
  const primeCoachPhotoUrl = stadiumFor(coach.id, true).coachPhotoUrl;
  // Nível 5 unlocks the Prime stadium image as the club's visual stadium;
  // it does not evolve the coach or grant the Prime thematic coach effects.
  const displayedStadium = stadiumDisplayFor(coach.id, coachPrime, stadiumProjectLevel);
  const hasPrime = !!primeDefinition;
  const showButton = !!onEvolve && !coachPrime && hasPrime;
  const reportCoachPhoto = coachPrime && primeCoachPhotoUrl ? primeCoachPhotoUrl : coach.photoUrl;

  if (reportSummary) {
    return (
      <div className="ui-panel overflow-hidden">
        <div className="ui-panel__header justify-center text-center">
          <span className="ui-panel__title">Técnico &amp; estádio</span>
        </div>
        <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0" style={{ borderColor: '#1A1A2A' }}>
          <div className="flex min-h-[164px] flex-col items-center justify-center px-5 py-6 text-center">
            <div className="text-[10px] font-black tracking-[0.18em]" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
              TÉCNICO
            </div>
            {reportCoachPhoto && (
              <div className="relative mt-3 h-[100px] w-[100px] flex-shrink-0">
                <img
                  src={reportCoachPhoto}
                  alt={coach.name}
                  referrerPolicy="no-referrer"
                  className="h-[100px] w-[100px] rounded-xl object-cover"
                  style={{ border: `2px solid ${coachPrime ? '#E8C84A' : '#C9A84C55'}`, objectPosition: 'center top' }}
                />
                {coachPrime && <img src="/coaches/prime/moldura.webp" alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />}
              </div>
            )}
            <div className="mt-2 text-2xl font-black leading-none" style={{ color: '#FFF', fontFamily: 'Bebas Neue, sans-serif' }}>
              {coach.name}
            </div>
            <div className="mt-2 text-sm font-black" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>
              {coach.philosophy}
            </div>
            <p className="mt-2 max-w-md text-xs leading-relaxed" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>
              {coach.description}
            </p>
          </div>
          <div className="flex min-h-[164px] flex-col items-center justify-center px-5 py-6 text-center">
            <div className="text-[10px] font-black tracking-[0.18em]" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
              ESTÁDIO
            </div>
            {reportStadiumImgOk && (
              <img
                src={displayedStadium.photoUrl}
                alt={displayedStadium.name}
                onError={() => setReportStadiumImgOk(false)}
                className="mt-3 h-[120px] w-[120px] rounded-xl object-cover"
                style={{ border: `2px solid ${displayedStadium.prime ? '#E8C84A88' : '#16A34A55'}` }}
              />
            )}
            <div className="mt-3 text-2xl font-black leading-none" style={{ color: '#FFF', fontFamily: 'Bebas Neue, sans-serif' }}>
              {displayedStadium.name}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-panel overflow-hidden">
      <CoachCard coach={coach} formation={formation} isPrime={coachPrime} primePhotoUrl={primeCoachPhotoUrl} bare showHeader={false} />

      {/* Botão de evoluir — exclusivo da seção do técnico */}
      {showButton && (
        <div className="px-4 pb-4 -mt-1">
          <Button intent="primary" className="w-full" onClick={() => setShowModal(true)}>
            ⭐ EVOLUIR TÉCNICO → PRIME
          </Button>
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent
          disableAnimation
          overlayClassName="z-[100] bg-[rgba(4,7,14,0.9)]"
          closeButtonLabel="Fechar evolução Prime"
          closeButtonClassName="right-3 top-3 flex size-9 items-center justify-center rounded-lg bg-[#171727] p-0 text-[#D8D8E5] opacity-100 hover:bg-[#24243A] [&_svg]:size-4"
          className="ui-modal z-[101] flex h-[min(700px,calc(100dvh-1rem))] min-h-0 max-h-[calc(100dvh-1rem)] max-w-lg flex-col gap-0 overflow-hidden p-0"
        >
            <div className="ui-modal__header flex-shrink-0 items-center justify-start gap-3 border-b border-[#24243A] px-5 py-4 pr-14">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#C9A84C66] bg-[#C9A84C18] text-xl" aria-hidden="true">⭐</span>
              <div className="min-w-0">
                <div className="text-[10px] font-black tracking-[0.16em] text-[#8A8A9A]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>EVOLUÇÃO DO TÉCNICO</div>
                <DialogTitle className="mt-0.5 text-2xl leading-none tracking-wide text-[#E8C84A]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>EVOLUÇÃO PRIME</DialogTitle>
                <div className="mt-1 truncate text-xs font-bold text-[var(--ui-text-muted)]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{coach.name} · {primeDefinition?.name ?? 'Assinatura Prime'}</div>
              </div>
            </div>

            <div className="ui-modal__body ui-stack min-h-0 min-w-0 flex-1 basis-0 overflow-x-hidden overflow-y-auto overscroll-contain p-4 sm:p-5">
              <TransitionRow
                before={
                  <img src={coach.photoUrl} alt={coach.name} referrerPolicy="no-referrer" className="mx-auto h-28 w-28 rounded-xl object-cover sm:h-32 sm:w-32"
                    style={{ objectPosition: 'center top', filter: 'grayscale(0.45) brightness(0.8)', border: '1px solid #2A2A3A' }} />
                }
                after={
                  <div className="relative mx-auto h-28 w-28 sm:h-32 sm:w-32">
                    <img src={primeCoachPhotoUrl ?? coach.photoUrl} alt={coach.name + ' Prime'} className="h-full w-full rounded-xl object-cover" style={{ objectPosition: 'center top', border: '2px solid #E8C84A' }} />
                    <img src="/coaches/prime/moldura.webp" alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
                  </div>
                }
              />

              <section className="ui-panel ui-panel--inset min-w-0 shrink-0 overflow-hidden">
                <div className="ui-panel__header flex items-center justify-between py-2.5">
                  <span className="text-[var(--ui-brand-strong)]">O QUE MUDA</span>
                </div>
                <div className="grid gap-2 p-3 sm:grid-cols-2" style={{ background: '#0d0d16', fontFamily: 'Rajdhani, sans-serif' }}>
                  <div className="rounded-lg border border-[#24243A] bg-[#0A0A14] p-2.5">
                    <div className="text-[10px] font-black tracking-widest text-[#8A8A9A]">ANTES</div>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#C9C9D5]">{primeDefinition?.normal ?? coach.specialAbility}</p>
                  </div>
                  <div className="rounded-lg border border-[#C9A84C66] bg-[#C9A84C0D] p-2.5">
                    <div className="text-[10px] font-black tracking-widest text-[#E8C84A]">DEPOIS · PRIME</div>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#F1E5B2]">{primeDefinition?.prime ?? 'A habilidade especial fica mais forte.'}</p>
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-black tracking-[0.16em] text-[#7E7E92]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>REQUISITOS PARA DESBLOQUEAR</div>
                  <span className="text-[10px] font-bold text-[#6A6A7A]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>PRIME</span>
                </div>
                <ProgressRequirement label="Vitórias na campanha" current={wins} target={PRIME_WINS_REQUIRED} />
                <ProgressRequirement label="Créditos disponíveis" current={points} target={PRIME_COST} />
              </section>
            </div>

            <div className="ui-modal__footer relative z-10 flex-shrink-0 gap-2 border-t border-[#24243A] px-4 py-3 sm:px-5">
              <Button type="button" intent="ghost" className="flex-1" onClick={() => setShowModal(false)}>CANCELAR</Button>
              <Button type="button" intent="primary" className="flex-[1.35]" disabled={!canEvolve} onClick={() => { onEvolve?.(); setShowModal(false); }}>
                EVOLUIR · {PRIME_COST} CRÉDITOS
              </Button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
