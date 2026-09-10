import { useState } from 'react';
import { Coach, Formation } from '../../lib/gameData';
import { Stadium, DEFAULT_STADIUM, stadiumFor } from '../../lib/stadium';
import { PRIME_COST, PRIME_WINS_REQUIRED } from '../../lib/shop';
import CoachCard from './CoachCard';
import StadiumCard from './StadiumCard';
import { Button } from '../../design-system';

const ATTR_PT: Record<string, string> = { pace: 'Ritmo', shooting: 'Finalização', passing: 'Passe', dribbling: 'Drible', defending: 'Defesa', physical: 'Físico', vision: 'Visão', composure: 'Compostura' };

interface Props {
  coach: Coach;
  formation?: Formation;
  coachPrime: boolean;
  stadium: Stadium;
  wins?: number;
  points?: number;
  onEvolve?: () => void; // presente só no MEU TIME (editável); ausente = só exibição
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
    <div>
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

// Uma linha de mudança "de → para".
function ChangeRow({ icon, label, from, to, last }: { icon: string; label: string; from: string; to: string; last?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2" style={{ borderBottom: last ? 'none' : '1px solid #14141F' }}>
      <span className="text-sm flex-shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-bold tracking-wider" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>{label}</div>
        <div className="flex items-center gap-1.5 text-[11px] font-bold leading-tight" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
          <span style={{ color: '#8A8A9A' }}>{from}</span>
          <span style={{ color: '#C9A84C' }}>→</span>
          <span style={{ color: '#E8C84A' }}>{to}</span>
        </div>
      </div>
    </div>
  );
}

// Card único "TÉCNICO & ESTÁDIO": técnico em cima (com o botão de evoluir), estádio embaixo.
export default function CoachStadiumPanel({ coach, formation, coachPrime, stadium, wins = 0, points = 0, onEvolve }: Props) {
  const [showModal, setShowModal] = useState(false);
  const canEvolve = wins >= PRIME_WINS_REQUIRED && points >= PRIME_COST;
  const primeStadium = stadiumFor(coach.id, true);
  const hasPrime = primeStadium.prime === true;
  const showButton = !!onEvolve && !coachPrime && hasPrime;
  const themedAttrNames = primeStadium.themedAttrs ? primeStadium.themedAttrs.map(a => ATTR_PT[a]) : [];
  const themedAttrsJsx = themedAttrNames.map((n, i) => (
    <span key={n}>{i > 0 ? ' e ' : ''}<b style={{ color: '#FFF' }}>{n}</b></span>
  ));
  const themedTargetPrefix = primeStadium.themedClub ? 'do' : 'de';
  const themedTargetName = primeStadium.themedClub ?? primeStadium.themedNation ?? '';

  return (
    <div className="ui-panel overflow-hidden">
      <div className="ui-panel__header">
        <span className="ui-panel__title">Técnico &amp; estádio</span>
        {coachPrime && <span className="ui-badge ui-badge--brand">Prime</span>}
      </div>

      <CoachCard coach={coach} formation={formation} isPrime={coachPrime} primePhotoUrl={stadium.coachPhotoUrl} bare />

      {/* Botão de evoluir — na parte do técnico, acima do estádio */}
      {showButton && (
        <div className="px-4 pb-4 -mt-1">
          <Button intent="primary" className="w-full" onClick={() => setShowModal(true)}>
            ⭐ EVOLUIR TÉCNICO → PRIME
          </Button>
        </div>
      )}

      <div style={{ height: 1, background: '#1A1A2A' }} />
      <StadiumCard stadium={stadium} bare />

      {showModal && (
        <div className="ui-modal-backdrop z-50" onClick={() => setShowModal(false)}>
          <div className="ui-modal max-w-md flex max-h-[90vh] flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="ui-modal__header flex-shrink-0 justify-start">
              <span className="text-xl">⭐</span>
              <div className="min-w-0">
                <div className="ui-modal__title">Evolução Prime</div>
                <div className="truncate text-xs text-[var(--ui-text-muted)]">{coach.name} · {primeStadium.name}</div>
              </div>
            </div>

            {/* Corpo rolável */}
            <div className="ui-modal__body ui-stack">
              {/* Transição do técnico */}
              <TransitionRow
                label="TÉCNICO"
                before={
                  <img src={coach.photoUrl} alt={coach.name} referrerPolicy="no-referrer" className="w-28 h-28 rounded-lg object-cover mx-auto"
                    style={{ objectPosition: 'center top', filter: 'grayscale(0.45) brightness(0.8)', border: '1px solid #2A2A3A' }} />
                }
                beforeCaption="Agora"
                after={
                  <div className="relative w-28 h-28 mx-auto">
                    <img src={primeStadium.coachPhotoUrl} alt={`${coach.name} Prime`} className="w-28 h-28 rounded-lg object-cover" style={{ objectPosition: 'center top', border: '2px solid #E8C84A' }} />
                    <img src="/coaches/prime/moldura.webp" alt="" aria-hidden className="absolute inset-0 w-full h-full pointer-events-none" />
                  </div>
                }
                afterCaption="Prime"
              />

              {/* Transição do estádio */}
              <TransitionRow
                label="ESTÁDIO"
                before={<img src={DEFAULT_STADIUM.photoUrl} alt="Estádio Padrão" className="w-28 h-28 rounded-lg object-cover mx-auto" style={{ filter: 'grayscale(0.35) brightness(0.85)', border: '1px solid #2A2A3A' }} />}
                beforeCaption="Estádio Padrão"
                after={<img src={primeStadium.photoUrl} alt={primeStadium.name} className="w-28 h-28 rounded-lg object-cover mx-auto" style={{ border: '2px solid #E8C84A' }} />}
                afterCaption={primeStadium.name}
              />

              {/* Mudanças detalhadas */}
              <div className="ui-panel ui-panel--inset overflow-hidden">
                <div className="ui-panel__header py-2 text-[var(--ui-brand-strong)]">O que muda</div>
                <ChangeRow icon="🏟️" label="Estádio" from="Padrão" to={primeStadium.name} />
                <ChangeRow icon="🏠" label="Vantagem em casa" from={`+${DEFAULT_STADIUM.homeAttrBonus} em tudo`} to={`+${primeStadium.homeAttrBonus} em tudo`} />
                {/* Buff temático explicado (não é um simples de→para) */}
                <div className="px-3 py-2.5" style={{ background: '#0d0d16' }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm">⚡</span>
                    <span className="text-[10px] font-black tracking-wider" style={{ color: '#E8C84A', fontFamily: 'Rajdhani, sans-serif' }}>BUFF TEMÁTICO EM CASA</span>
                  </div>
                  <div className="text-[11px] leading-snug space-y-1" style={{ color: '#C9C9D5', fontFamily: 'Rajdhani, sans-serif' }}>
                    <div><b style={{ color: '#22C55E' }}>+3</b> de {themedAttrsJsx} para <b>todos</b> os seus titulares</div>
                    <div><b style={{ color: '#E8C84A' }}>+6</b> de {themedAttrsJsx} para os jogadores {themedTargetPrefix} <b style={{ color: '#FFF' }}>{themedTargetName}</b></div>
                  </div>
                </div>
              </div>

              {/* Requisitos */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-black tracking-widest" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>REQUISITOS</div>
                <Req ok={wins >= PRIME_WINS_REQUIRED} label={`Vitórias na campanha: ${wins}/${PRIME_WINS_REQUIRED}`} />
                <Req ok={points >= PRIME_COST} label={`Pontos: ${points}/${PRIME_COST}`} />
              </div>
            </div>

            {/* Ações (fixas no rodapé) */}
            <div className="ui-modal__footer flex-shrink-0">
              <Button intent="ghost" className="flex-1" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button intent="primary" className="flex-1" disabled={!canEvolve} onClick={() => { onEvolve?.(); setShowModal(false); }}>
                Confirmar (−{PRIME_COST} pts)
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
