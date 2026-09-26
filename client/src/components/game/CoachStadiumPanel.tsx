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

function Req({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-bold" style={{ fontFamily: 'Rajdhani, sans-serif', color: ok ? '#22C55E' : '#EF4444' }}>
      <span>{ok ? '✅' : '❌'}</span><span>{label}</span>
    </div>
  );
}

// Uma linha de transição "antes → depois" com fotos.
function TransitionRow({ label, before, beforeCaption, after, afterCaption }: { label: string; before: React.ReactNode; beforeCaption: string; after: React.ReactNode; afterCaption: string }) {
  return (
    <div className="min-w-0 shrink-0">
      <div className="text-[10px] font-black tracking-widest mb-1.5" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>{label}</div>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 text-center">
          {before}
          <div className="text-[9px] mt-1 font-bold truncate" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>{beforeCaption}</div>
        </div>
        <div className="flex-shrink-0 text-xl font-black" style={{ color: '#C9A84C' }}>→</div>
        <div className="flex-1 min-w-0 text-center">
          {after}
          <div className="text-[9px] mt-1 font-black truncate" style={{ color: '#E8C84A', fontFamily: 'Rajdhani, sans-serif' }}>{afterCaption}</div>
        </div>
      </div>
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
          showCloseButton={false}
          disableAnimation
          overlayClassName="z-[100] bg-[rgba(4,7,14,0.9)]"
          className="ui-modal z-[101] flex min-h-0 max-h-[calc(100dvh-1rem)] max-w-md flex-col gap-0 overflow-hidden p-0"
          style={{ height: 'min(720px, calc(100dvh - 1rem))', maxHeight: 'calc(100dvh - 1rem)' }}
        >
            {/* Header */}
            <div className="ui-modal__header flex-shrink-0 justify-start">
              <span className="text-xl">⭐</span>
              <div className="min-w-0">
                <DialogTitle className="ui-modal__title">Evolução Prime</DialogTitle>
                <div className="truncate text-xs text-[var(--ui-text-muted)]">{coach.name} · {primeDefinition?.name ?? 'Assinatura Prime'}</div>
              </div>
            </div>

            {/* Corpo rolável */}
            <div className="ui-modal__body ui-stack min-h-0 min-w-0 flex-1 basis-0 overflow-x-hidden overflow-y-auto overscroll-contain touch-pan-y">
              {/* Transição do técnico */}
              <TransitionRow
                label="TÉCNICO · ANTES E DEPOIS"
                before={
                  <img src={coach.photoUrl} alt={coach.name} referrerPolicy="no-referrer" className="w-28 h-28 rounded-lg object-cover mx-auto"
                    style={{ objectPosition: 'center top', filter: 'grayscale(0.45) brightness(0.8)', border: '1px solid #2A2A3A' }} />
                }
                beforeCaption="ANTES"
                after={
                  <div className="relative w-28 h-28 mx-auto">
                    <img src={primeCoachPhotoUrl ?? coach.photoUrl} alt={coach.name + ' Prime'} className="w-28 h-28 rounded-lg object-cover" style={{ objectPosition: 'center top', border: '2px solid #E8C84A' }} />
                    <img src="/coaches/prime/moldura.webp" alt="" aria-hidden className="absolute inset-0 w-full h-full pointer-events-none" />
                  </div>
                }
                afterCaption="DEPOIS · PRIME"
              />

              {/* Mudanças detalhadas */}
              <div className="ui-panel ui-panel--inset min-w-0 shrink-0 overflow-hidden">
                <div className="ui-panel__header py-2 text-[var(--ui-brand-strong)]">O que muda</div>
                <div className="px-3 py-2.5" style={{ background: '#0d0d16' }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm">⭐</span>
                    <span className="text-[10px] font-black tracking-wider" style={{ color: '#E8C84A', fontFamily: 'Rajdhani, sans-serif' }}>{primeDefinition?.name ?? 'ASSINATURA PRIME'}</span>
                  </div>
                  <div className="space-y-2 text-[11px] leading-snug" style={{ color: '#C9C9D5', fontFamily: 'Rajdhani, sans-serif' }}>
                    <div><b style={{ color: '#8A8A9A' }}>Antes:</b> {primeDefinition?.normal ?? coach.specialAbility}</div>
                    <div><b style={{ color: '#E8C84A' }}>Depois:</b> {primeDefinition?.prime ?? 'A habilidade especial fica mais forte.'}</div>
                    <div><b style={{ color: '#8A8A9A' }}>Ativa quando:</b> {primeDefinition?.condition ?? 'Conforme a situação da partida.'}</div>
                  </div>
                </div>
              </div>

              {/* Requisitos */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-black tracking-widest" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>REQUISITOS</div>
                <Req ok={wins >= PRIME_WINS_REQUIRED} label={`Vitórias na campanha: ${wins}/${PRIME_WINS_REQUIRED}`} />
                <Req ok={points >= PRIME_COST} label={`Créditos: ${points}/${PRIME_COST}`} />
              </div>
            </div>

            {/* Ações (fixas no rodapé) */}
            <div className="ui-modal__footer relative z-10 flex-shrink-0">
              <Button type="button" intent="ghost" className="flex-1" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="button" intent="primary" className="flex-1" disabled={!canEvolve} onClick={() => { onEvolve?.(); setShowModal(false); }}>
                Confirmar (−{PRIME_COST} pts)
              </Button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
