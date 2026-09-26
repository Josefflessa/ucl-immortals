// UCL Immortals — explains the TEAM-WIDE chemistry bonus.
// The chem card used to show only the 0–100 total with no hint of what it grants.
// This surfaces the active global bonus (+Passe/+Ritmo to ALL starters) and the
// full tier table, highlighting the tier the team is currently in.
import { useState } from 'react';
import { Info } from 'lucide-react';
import { getChemistryBonus } from '../../lib/gameEngine';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

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
  const [showDetails, setShowDetails] = useState(false);
  const b = getChemistryBonus(total);
  const active = b.passing > 0 || b.pace > 0;
  const activeTier = TIERS.find(t => total >= t.min);

  return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: '#1A1A2A' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-black tracking-widest text-gray-300" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
            BÔNUS GLOBAL
          </div>
          <div className="mt-0.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
            todos os titulares
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowDetails(true)}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider transition-colors hover:bg-[#C9A84A18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8C84A]"
          style={{ color: '#E8C84A', borderColor: '#C9A84A66', background: '#C9A40A0D', fontFamily: 'Rajdhani, sans-serif' }}
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
          {b.special > 0 && <Chip text={`✨ +${b.special} em todos`} />}
        </div>
      ) : (
        <div className="mt-3 rounded-lg border px-3 py-2 text-sm leading-relaxed" style={{ color: '#8A8A9A', borderColor: '#24243A', background: '#0A0A14', fontFamily: 'Rajdhani, sans-serif' }}>
          Química abaixo de 45 — sem bônus global. Aumente a química para liberar.
        </div>
      )}

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent
          disableAnimation
          overlayClassName="bg-black/85"
          closeButtonLabel="Fechar bônus de química"
          closeButtonClassName="right-3 top-3 flex size-9 items-center justify-center rounded-lg bg-[#171727] p-0 text-[#D8D8E5] opacity-100 hover:bg-[#24243A] [&_svg]:size-4"
          className="max-h-[min(88dvh,620px)] max-w-md overflow-y-auto border-[#30304A] bg-[#0F0F1A] p-4 text-[#F3F3FA] shadow-2xl sm:p-5"
        >
          <DialogHeader className="pr-10 text-left">
            <DialogTitle className="text-xl font-black tracking-wider text-[#E8C84A]" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              BÔNUS DE QUÍMICA
            </DialogTitle>
            <div className="text-sm leading-relaxed text-[#A7A7B8]" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
              Efeitos aplicados aos 11 titulares durante a partida.
            </div>
          </DialogHeader>

          <div className="mt-2 space-y-2">
            {TIERS.map(t => {
              const isActive = activeTier?.min === t.min;
              return (
                <div
                  key={t.min}
                  className="rounded-lg border px-3 py-2.5"
                  style={{
                    color: isActive ? '#E8C84A' : '#8A8A9A',
                    borderColor: isActive ? '#C9A84C88' : '#202034',
                    background: isActive ? '#C9A84C12' : '#0A0A14',
                    fontFamily: 'Rajdhani, sans-serif',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-black">{t.label} de química</div>
                    {isActive && <span className="text-[10px] font-black uppercase tracking-wider">ATIVA</span>}
                  </div>
                  <div className="mt-0.5 text-xs leading-relaxed" style={{ color: isActive ? '#D8C47A' : '#6A6A7A' }}>
                    +{t.pas} Passe{t.rit > 0 ? ` · +${t.rit} Ritmo` : ''}{t.special > 0 ? ` · +${t.special} em todos ✨` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
