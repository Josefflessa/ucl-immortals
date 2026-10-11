// UCL Immortals — explains the TEAM-WIDE chemistry bonus.
// The chem card used to show only the 0–100 total with no hint of what it grants.
// This surfaces the active global bonus (+Passe/+Ritmo to ALL starters) and the
// full tier table, highlighting the tier the team is currently in.
import { useState } from 'react';
import { Check, Info, Lock } from 'lucide-react';
import { getChemistryBonus } from '@shared/game/gameEngine';
import { GameModal } from '../../design-system';
import { Sparkles } from 'lucide-react';
import { INLINE_ICON } from './inlineIcon';

// Bonus is applied as chemBonus.{passing,pace} * 2 in both the engine and the
// effective-stats preview, so the real stat points are double the raw tier value.
const TIERS = [90, 75, 60, 45].map(min => {
  const bonus = getChemistryBonus(min);
  return { min, label: `${min}+`, pas: bonus.passing * 2, rit: bonus.pace * 2, special: bonus.special };
});

const Chip = ({ text }: { text: React.ReactNode }) => (
  <span className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-black"
    style={{ background: '#C9A84C22', color: 'var(--ui-brand-strong)', border: '1px solid #C9A84C44', fontFamily: 'var(--font-game), sans-serif' }}>
    {text}
  </span>
);

export default function ChemistryBonusInfo({ total }: { total: number }) {
  const [showDetails, setShowDetails] = useState(false);
  const b = getChemistryBonus(total);
  const active = b.passing > 0 || b.pace > 0;
  const activeTier = TIERS.find(t => total >= t.min);
  // The lowest tier still above the team (TIERS runs from the top down).
  const nextTier = [...TIERS].reverse().find(t => total < t.min);

  return (
    <div className="mt-3 flex flex-1 flex-col border-t pt-3" style={{ borderColor: 'var(--ui-surface-3)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-black tracking-widest text-gray-300" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
            BÔNUS GLOBAL
          </div>
          <div className="mt-0.5 text-[13px] font-bold uppercase tracking-wider" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
            todos os titulares
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowDetails(true)}
          className="inline-flex min-h-9 shrink-0 items-center lg:hidden gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] font-black uppercase tracking-wider transition-colors hover:bg-[#C9A84A18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-strong"
          style={{ color: 'var(--ui-brand-strong)', borderColor: '#C9A84A66', background: '#C9A40A0D', fontFamily: 'var(--font-game), sans-serif' }}
          aria-label="Ver faixas e efeitos do bônus de química"
        >
          <Info size={15} aria-hidden="true" />
          <span>VER BÔNUS</span>
        </button>
      </div>
      {active ? (
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          {b.passing > 0 && <Chip text={`+${b.passing * 2} Passe`} />}
          {b.pace > 0 && <Chip text={`+${b.pace * 2} Ritmo`} />}
          {b.special > 0 && <Chip text={<><Sparkles {...INLINE_ICON} />+{b.special} em todos</>} />}
        </div>
      ) : (
        <div className="mt-3 rounded-lg border px-3 py-2 text-sm leading-relaxed" style={{ color: '#8A8A9A', borderColor: '#24243A', background: '#0A0A14', fontFamily: 'var(--font-game), sans-serif' }}>
          Química abaixo de 45 — sem bônus global. Aumente a química para liberar.
        </div>
      )}

      {/* On a computer there is room beside the plan: the tiers right here, the next one to reach on
          top. A phone opens them from the button instead. */}
      <div className="hidden pt-4 lg:mt-auto lg:block">
        <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-black uppercase tracking-[0.14em]" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
          <span className="text-[var(--ui-text-faint)]">Faixas de química</span>
          {nextTier && <span style={{ color: 'var(--ui-brand)' }}>faltam {nextTier.min - total} para {nextTier.label}</span>}
        </div>
        <div className="space-y-1">
          {TIERS.map(t => {
            const reached = total >= t.min;
            const isActive = activeTier?.min === t.min;
            return (
              <div
                key={t.min}
                className="flex items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-xs"
                style={{
                  color: isActive ? 'var(--ui-brand-strong)' : reached ? '#B8B8C8' : '#6E6E86',
                  borderColor: isActive ? '#C9A84C88' : '#202034',
                  background: isActive ? '#C9A84C12' : '#0A0A14',
                  fontFamily: 'var(--font-game), sans-serif',
                }}
              >
                {reached ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : <Lock size={12} strokeWidth={2.5} aria-hidden="true" />}
                <span className="w-8 shrink-0 font-black tabular-nums">{t.label}</span>
                <span className="min-w-0 flex-1 truncate">+{t.pas} Passe{t.rit > 0 ? ` · +${t.rit} Ritmo` : ''}{t.special > 0 ? ` · +${t.special} em todos` : ''}</span>
                {isActive && <span className="shrink-0 text-[11px] font-black uppercase tracking-wider">Ativa</span>}
              </div>
            );
          })}
        </div>
      </div>

      <GameModal
        open={showDetails}
        onOpenChange={setShowDetails}
        size="default"
        closeLabel="Fechar bônus de química"
        title={<span className="text-xl font-black tracking-wider text-brand-strong" style={{ fontFamily: 'var(--font-display), sans-serif' }}>BÔNUS DE QUÍMICA</span>}
        subtitle="Efeitos aplicados aos 11 titulares durante a partida."
      >
        <div className="space-y-2">
          {TIERS.map(t => {
            const isActive = activeTier?.min === t.min;
            return (
              <div
                key={t.min}
                className="rounded-lg border px-3 py-2.5"
                style={{
                  color: isActive ? 'var(--ui-brand-strong)' : '#8A8A9A',
                  borderColor: isActive ? '#C9A84C88' : '#202034',
                  background: isActive ? '#C9A84C12' : '#0A0A14',
                  fontFamily: 'var(--font-game), sans-serif',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-black">{t.label} de química</div>
                  {isActive && <span className="text-[12px] font-black uppercase tracking-wider">ATIVA</span>}
                </div>
                <div className="mt-0.5 text-xs leading-relaxed" style={{ color: isActive ? '#D8C47A' : 'var(--ui-text-faint)' }}>
                  +{t.pas} Passe{t.rit > 0 ? ` · +${t.rit} Ritmo` : ''}{t.special > 0 ? ` · +${t.special} em todos` : ''}
                </div>
              </div>
            );
          })}
        </div>
      </GameModal>
    </div>
  );
}
