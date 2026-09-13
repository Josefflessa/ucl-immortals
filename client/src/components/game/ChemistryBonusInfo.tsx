// UCL Immortals — explains the TEAM-WIDE chemistry bonus.
// The chem card used to show only the 0–100 total with no hint of what it grants.
// This surfaces the active global bonus (+Passe/+Ritmo to ALL starters) and the
// full tier table, highlighting the tier the team is currently in.
import { getChemistryBonus } from '../../lib/gameEngine';

// Bonus is applied as chemBonus.{passing,pace} * 2 in both the engine and the
// effective-stats preview, so the real stat points are double the raw tier value.
const TIERS = [
  { min: 90, label: '90+', pas: 6, rit: 4, special: 5 },
  { min: 75, label: '75+', pas: 4, rit: 2, special: 3 },
  { min: 60, label: '60+', pas: 2, rit: 2, special: 2 },
  { min: 45, label: '45+', pas: 2, rit: 0, special: 1 },
];

const Chip = ({ text }: { text: string }) => (
  <span className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-black"
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
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
        <div className="text-xs font-black tracking-widest text-gray-300" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
          BÔNUS GLOBAL
        </div>
        <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
          todos os titulares
        </div>
      </div>
      <p className="text-sm leading-relaxed text-pretty" style={{ color: '#A7A7B8', fontFamily: 'Rajdhani, sans-serif' }}>
        A química da equipe libera bônus que entram nos atributos de cada titular durante a partida.
      </p>
      {active ? (
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          {b.passing > 0 && <Chip text={`+${b.passing * 2} Passe`} />}
          {b.pace > 0 && <Chip text={`+${b.pace * 2} Ritmo`} />}
          {b.special > 0 && <Chip text={`✨ +${b.special} em todos`} />}
        </div>
      ) : (
        <div className="mt-3 rounded-lg border px-3 py-2 text-sm leading-relaxed" style={{ color: '#8A8A9A', borderColor: '#24243A', background: '#0A0A14', fontFamily: 'Rajdhani, sans-serif' }}>
          Química abaixo de 45 — sem bônus global. Aumente a química para liberar.
        </div>
      )}
      {/* Tier table — the active tier is highlighted in gold. */}
      <div className="mt-4">
        <div className="text-xs font-black uppercase tracking-wider" style={{ color: '#7A7A8A', fontFamily: 'Rajdhani, sans-serif' }}>
          Escalas de química
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {TIERS.map(t => {
            const isActive = activeTier?.min === t.min;
            return (
              <div key={t.min} className="rounded-lg border px-3 py-2" style={{ color: isActive ? '#E8C84A' : '#8A8A9A', borderColor: isActive ? '#C9A84C88' : '#202034', background: isActive ? '#C9A84C12' : '#0A0A14', fontFamily: 'Rajdhani, sans-serif' }}>
                <div className="text-sm font-black">{t.label} de química</div>
                <div className="mt-0.5 text-xs leading-relaxed" style={{ color: isActive ? '#D8C47A' : '#6A6A7A' }}>
                  +{t.pas} Passe{t.rit > 0 ? ` · +${t.rit} Ritmo` : ''}{t.special > 0 ? ` · +${t.special} em todos ✨` : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
