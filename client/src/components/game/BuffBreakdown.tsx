// UCL Immortals — explains WHERE a player's stat buffs come from.
// The detail modal shows the net delta per stat, but not its sources. This breaks
// the uplift into: individual chemistry (a multiplier + WHY, via the connection web),
// team-wide chemistry, the coach, the player's traits (named, with what each grants)
// and the tactic — data-driven from EffectiveStats.breakdown so it always matches what
// the match engine actually uses.
import { EffectiveStats, ChemLinkType } from '../../lib/gameEngine';
import { Player } from '../../lib/gameData';
import { getCardVariant } from './PlayerCard';

const ATTR_PT: Record<string, string> = {
  pace: 'RIT', shooting: 'FIN', passing: 'PAS', dribbling: 'DRI', defending: 'DEF', physical: 'FIS',
  vision: 'VIS', composure: 'CMP',
};
const ATTRS = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'vision', 'composure'] as const;

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

export default function BuffBreakdown({ eff, chem, traits, player }: { eff: EffectiveStats; chem?: ChemInfo; traits?: TraitInfo[]; player?: Player }) {
  const chemNet = ATTRS.reduce((s, a) => s + eff.breakdown[a].chem, 0);
  const coach = collect(eff, b => b.coach);
  const traitDeltas = collect(eff, b => b.trait);
  const tactic = collect(eff, b => b.tactic);
  const captain = collect(eff, b => b.captain);
  const hasGlobal = eff.globalChemBonus.passing > 0 || eff.globalChemBonus.pace > 0 || eff.globalChemBonus.special > 0;
  const showChem = chemNet !== 0 || !!chem;
  const showTraits = (traits && traits.length > 0) || traitDeltas.length > 0;
  // Special draft variant (em alta / lobo / coringa / nômade / pilar) — surfaced here so its
  // effect is visible. The stat boost (em alta / lobo) lives in the BASE stats, so it never
  // shows as a per-stat delta below; the chem effects (coringa/nômade/pilar/lobo) live in the team total.
  const variant = player ? getCardVariant(player) : null;
  const variantBoost = player?.baseOverall !== undefined ? (player.overall - player.baseOverall) : (player?.inForm ? 3 : player?.lobo ? 6 : 0);
  const variantColor = variant?.color === '#FFFFFF' ? '#E5E7EB' : (variant?.color ?? '#9AA8C8');
  // Named coach effects (e.g. "Visão de Jogo: +3 Geral") are ALREADY folded into the
  // per-stat TREINADOR chips below — caption them so the bonus never reads as doubled.
  const activeCoach = eff.activeCoachEffects ?? [];
  const showCaptain = captain.length > 0;
  const anything = showChem || hasGlobal || coach.length > 0 || showTraits || tactic.length > 0 || showCaptain || !!variant;

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
          {/* SPECIAL DRAFT VARIANT — em alta / lobo / coringa / nômade / pilar. Stat boosts live in
              the base stats and chem effects in the team total, so neither shows as a delta above. */}
          {variant && player && (
            <Row icon={variant.icon} name={`${variant.label} (CARTA ESPECIAL)`} color={variantColor}>
              <div className="flex flex-wrap gap-1">
                {variantBoost > 0 && <Chip text={`+${variantBoost} EM CADA ATRIBUTO`} color={variantColor} />}
                {player.lobo && <Chip text="−12 QUÍMICA GERAL DO TIME" color="#EF4444" />}
                {player.pilar && <Chip text="+12 QUÍMICA GERAL DO TIME" color={variantColor} />}
                {player.coringa && <Chip text="IMUNE A FORA-DE-POSIÇÃO" color={variantColor} />}
                {player.nomade && <Chip text="QUALQUER NAÇÃO NA QUÍMICA" color={variantColor} />}
              </div>
              <div className="text-[9px] text-gray-500 mt-1" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                {player.coringa ? 'Joga em qualquer posição sem penalidade de stats nem química.'
                  : player.nomade ? 'Forma vínculo de química com jogadores de qualquer nação.'
                  : player.pilar ? 'Eleva a QUÍMICA GERAL do time (o número total) só por estar na escalação.'
                  : player.lobo ? 'Boost individual forte — mas reduz a QUÍMICA GERAL do time (o número total).'
                  : 'Já no valor base — por isso não aparece como delta acima.'}
              </div>
            </Row>
          )}

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
                {eff.globalChemBonus.special > 0 && <Chip text={`✨ +${eff.globalChemBonus.special} EM TODOS`} color="#C9A84C" />}
              </div>
              {eff.globalChemBonus.special > 0 && (
                <div className="text-[9px] text-gray-500 mt-1" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  Química perfeita (90+): <b style={{ color: '#E8C84A' }}>+{eff.globalChemBonus.special} em todos os atributos</b> de todos os titulares.
                </div>
              )}
            </Row>
          )}

          {/* CAPTAIN — the armband lifts the captain's single best stat by +3 for the WHOLE
              team (the captain included). Applied by the engine but never surfaced as a delta
              before, so without this row it was an invisible buff. */}
          {showCaptain && (
            <Row icon="👑" name="CAPITÃO" color="#3B82F6">
              <div className="flex flex-wrap gap-1">{chips(captain, '#3B82F6')}</div>
              <div className="text-[9px] text-gray-500 mt-1" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                A melhor estatística do capitão vira <b style={{ color: '#93C5FD' }}>+{captain[0]?.v ?? 3}</b> pra todo o time — inclusive pra ele.
              </div>
            </Row>
          )}

          {coach.length > 0 && (
            <Row icon="🎯" name="TREINADOR" color="#E8C84A">
              <div className="flex flex-wrap gap-1">{chips(coach, '#E8C84A')}</div>
              {activeCoach.length > 0 && (
                <div className="text-[9px] text-gray-500 mt-1" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  Já inclui: {activeCoach.join(' · ')}
                </div>
              )}
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
