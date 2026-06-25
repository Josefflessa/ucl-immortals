// UCL Immortals — explains WHERE a player's stat buffs come from.
// The detail modal shows the net delta per stat, but not its sources. This breaks
// the uplift into: individual chemistry (a multiplier + WHY, via the connection web),
// team-wide chemistry, the coach, the player's traits (named, with what each grants)
// and the tactic — data-driven from EffectiveStats.breakdown so it always matches what
// the match engine actually uses.
import { EffectiveStats, ChemLinkType } from '../../lib/gameEngine';

const ATTR_PT: Record<string, string> = {
  pace: 'RIT', shooting: 'FIN', passing: 'PAS', dribbling: 'DRI', defending: 'DEF', physical: 'FIS',
};
const ATTRS = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'] as const;

type Delta = { a: string; v: number };

// Individual-chemistry context: who this player connects with (and why), or why he is OOP.
export interface ChemInfo {
  oop: boolean;
  nativePos: string;      // PT label of the player's natural position
  formationPos: string;   // PT label of the slot he's filling
  links: { type: ChemLinkType; label: string; color: string; names: string[] }[];
  rawPts: number;         // raw link points (the chem LEVEL is round(rawPts / 3))
  nextAt: number | null;  // raw pts needed for the next level (null when maxed at 3/3)
}
// The player's traits, each with what it grants and a short flavour line.
export interface TraitInfo { id: string; icon: string; effect: string; flavor: string }

function collect(eff: EffectiveStats, pick: (b: EffectiveStats['breakdown']['pace']) => number): Delta[] {
  return ATTRS.map(a => ({ a, v: pick(eff.breakdown[a]) })).filter(x => x.v !== 0);
}

function Chip({ text, color }: { text: string; color: string }) {
  return (
    <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44`, fontFamily: 'Rajdhani, sans-serif' }}>
      {text}
    </span>
  );
}

function Row({ icon, name, color, children }: { icon: string; name: string; color: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-sm flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-black tracking-wider" style={{ color, fontFamily: 'Rajdhani, sans-serif' }}>{name}</div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

export default function BuffBreakdown({ eff, chem, traits }: { eff: EffectiveStats; chem?: ChemInfo; traits?: TraitInfo[] }) {
  const chemNet = ATTRS.reduce((s, a) => s + eff.breakdown[a].chem, 0);
  const coach = collect(eff, b => b.coach);
  const traitDeltas = collect(eff, b => b.trait);
  const tactic = collect(eff, b => b.tactic);
  const hasGlobal = eff.globalChemBonus.passing > 0 || eff.globalChemBonus.pace > 0;
  const showChem = chemNet !== 0 || !!chem;
  const showTraits = (traits && traits.length > 0) || traitDeltas.length > 0;
  const anything = showChem || hasGlobal || coach.length > 0 || showTraits || tactic.length > 0;

  const chips = (list: Delta[], color: string) =>
    list.map(({ a, v }) => <Chip key={a} text={`${v > 0 ? '+' : ''}${v} ${ATTR_PT[a]}`} color={color} />);
  const chemColor = chem?.oop || chemNet < 0 ? '#EF4444' : '#22C55E';

  return (
    <div className="px-4 py-3 border-t" style={{ borderColor: '#161626', background: '#09090f' }}>
      <div className="text-[9px] font-black text-gray-400 tracking-widest mb-1" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
        🧬 DE ONDE VEM O BÔNUS
      </div>
      {!anything ? (
        <div className="text-[10px] text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
          Sem modificadores ativos — atributos no valor base.
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: '#141422' }}>
          {/* INDIVIDUAL CHEMISTRY — the multiplier AND why (connections / out-of-position) */}
          {showChem && (
            <Row icon="🔗" color={chemColor}
              name={`QUÍMICA INDIVIDUAL (${eff.chemScore}/3)${chem?.oop ? ' · FORA DE POSIÇÃO' : ''}`}>
              <div className="flex flex-wrap gap-1">
                <Chip text={`×${eff.chemMult.toFixed(2)}`} color={chemColor} />
                {chemNet !== 0 && <Chip text={`${chemNet > 0 ? '+' : ''}${chemNet} no total`} color={chemColor} />}
              </div>
              {chem?.oop ? (
                <div className="text-[10px] leading-snug mt-1.5 rounded-md px-2 py-1.5" style={{ fontFamily: 'Rajdhani, sans-serif', color: '#FCA5A5', background: '#EF444415', border: '1px solid #EF444433' }}>
                  Joga como <b>{chem.formationPos}</b>, mas é <b>{chem.nativePos}</b> de origem → a química zera e ele perde rendimento. Troque por alguém da posição.
                </div>
              ) : chem && chem.links.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {chem.links.map(l => (
                      <span key={l.type} className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{ fontFamily: 'Rajdhani, sans-serif', color: l.color, background: `${l.color}1A`, border: `1px solid ${l.color}44` }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: l.color }} />
                        {l.label}: {l.names.join(', ')}
                      </span>
                    ))}
                  </div>
                  {chem.nextAt != null && (
                    <div className="text-[9px] text-gray-500 mt-1" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                      Vínculos somam <b style={{ color: '#CFCFE0' }}>{chem.rawPts} pt{chem.rawPts === 1 ? '' : 's'}</b>
                      {chem.rawPts < chem.nextAt
                        ? <> — faltam <b style={{ color: '#E8C84A' }}>{chem.nextAt - chem.rawPts}</b> pra subir 1 nível de química.</>
                        : <> — suficiente pro nível atual.</>}
                    </div>
                  )}
                </>
              ) : chem ? (
                <div className="text-[9px] text-gray-500 mt-1.5" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  Na posição certa, mas sem vínculos (clube/nação/técnico) com os titulares.
                </div>
              ) : null}
            </Row>
          )}

          {hasGlobal && (
            <Row icon="⭐" name="QUÍMICA DO TIME (global)" color="#C9A84C">
              <div className="flex flex-wrap gap-1">
                {eff.globalChemBonus.passing > 0 && <Chip text={`+${eff.globalChemBonus.passing} PAS`} color="#C9A84C" />}
                {eff.globalChemBonus.pace > 0 && <Chip text={`+${eff.globalChemBonus.pace} RIT`} color="#C9A84C" />}
              </div>
            </Row>
          )}

          {coach.length > 0 && (
            <Row icon="🎯" name="TREINADOR" color="#E8C84A">
              <div className="flex flex-wrap gap-1">{chips(coach, '#E8C84A')}</div>
            </Row>
          )}

          {/* TRAITS — each one named, with what it grants and a flavour line */}
          {showTraits && (
            <Row icon="✨" name="TRAITS" color="#A78BFA">
              {traits && traits.length > 0 ? (
                <div className="space-y-1">
                  {traits.map(t => (
                    <div key={t.id} className="flex items-start gap-1.5">
                      <span className="text-xs flex-shrink-0 leading-none mt-0.5">{t.icon}</span>
                      <div className="min-w-0">
                        <span className="text-[10px] font-black text-white" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{t.id}</span>
                        {t.effect && <span className="text-[9px] font-bold" style={{ color: '#A78BFA', fontFamily: 'Rajdhani, sans-serif' }}> — {t.effect}</span>}
                        {t.flavor && <div className="text-[8px] text-gray-500" style={{ fontFamily: 'Rajdhani, sans-serif' }}>{t.flavor}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">{chips(traitDeltas, '#A78BFA')}</div>
              )}
            </Row>
          )}

          {tactic.length > 0 && (
            <Row icon="📋" name="TÁTICA (ESTILO)" color="#4FC3F7">
              <div className="flex flex-wrap gap-1">{chips(tactic, '#4FC3F7')}</div>
            </Row>
          )}
        </div>
      )}
    </div>
  );
}
