// UCL Immortals — explains the TEAM-WIDE chemistry bonus.
// The chem card used to show only the 0–100 total with no hint of what it grants.
// This surfaces the active global bonus (+Passe/+Ritmo to ALL starters) and the
// full tier table, highlighting the tier the team is currently in.
import { getChemistryBonus } from '../../lib/gameEngine';

// Bonus is applied as chemBonus.{passing,pace} * 2 in both the engine and the
// effective-stats preview, so the real stat points are double the raw tier value.
const TIERS = [
  { min: 90, label: '90+', pas: 6, rit: 4, special: true },
  { min: 75, label: '75+', pas: 4, rit: 2, special: false },
  { min: 60, label: '60+', pas: 2, rit: 2, special: false },
  { min: 45, label: '45+', pas: 2, rit: 0, special: false },
];

const Chip = ({ text }: { text: string }) => (
  <span className="text-[10px] font-black px-2 py-0.5 rounded"
    style={{ background: '#C9A84C22', color: '#E8C84A', border: '1px solid #C9A84C44', fontFamily: 'Rajdhani, sans-serif' }}>
    {text}
  </span>
);

export default function ChemistryBonusInfo({ total }: { total: number }) {
  const b = getChemistryBonus(total);
  const active = b.passing > 0 || b.pace > 0;
  const activeTier = TIERS.find(t => total >= t.min);

  return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: '#1A1A2A' }}>
      <div className="text-[10px] font-black tracking-widest text-gray-400 mb-1.5" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
        BÔNUS GLOBAL — A TODOS OS TITULARES
      </div>
      {active ? (
        <div className="flex flex-wrap gap-1.5 items-center">
          {b.passing > 0 && <Chip text={`+${b.passing * 2} Passe`} />}
          {b.pace > 0 && <Chip text={`+${b.pace * 2} Ritmo`} />}
          {b.special && <Chip text="✨ +3 em todos (química perfeita)" />}
        </div>
      ) : (
        <div className="text-[10px] text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
          Química abaixo de 45 — sem bônus global. Aumente a química para liberar.
        </div>
      )}
      {/* Tier table — the active tier is highlighted in gold. */}
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-[9px]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
        {TIERS.map(t => {
          const isActive = activeTier?.min === t.min;
          return (
            <span key={t.min} style={{ color: isActive ? '#E8C84A' : '#5A5A6A', fontWeight: isActive ? 800 : 500 }}>
              {t.label} → +{t.pas} Passe{t.rit > 0 ? `, +${t.rit} Ritmo` : ''}{t.special ? ', +3 em todos ✨' : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}
