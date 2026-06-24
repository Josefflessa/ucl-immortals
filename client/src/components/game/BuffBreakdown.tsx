// UCL Immortals — explains WHERE a player's stat buffs come from.
// The detail modal shows the net delta per stat, but not its sources. This breaks
// the uplift into: individual chemistry (a multiplier), team-wide chemistry, the
// coach, traits and the tactic — each as labelled +X ATTR chips, data-driven from
// EffectiveStats.breakdown so it always matches what the match engine actually uses.
import { EffectiveStats } from '../../lib/gameEngine';

const ATTR_PT: Record<string, string> = {
  pace: 'RIT', shooting: 'FIN', passing: 'PAS', dribbling: 'DRI', defending: 'DEF', physical: 'FIS',
};
const ATTRS = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'] as const;

type Delta = { a: string; v: number };

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
        <div className="flex flex-wrap gap-1 mt-0.5">{children}</div>
      </div>
    </div>
  );
}

export default function BuffBreakdown({ eff }: { eff: EffectiveStats }) {
  const chemNet = ATTRS.reduce((s, a) => s + eff.breakdown[a].chem, 0);
  const coach = collect(eff, b => b.coach);
  const trait = collect(eff, b => b.trait);
  const tactic = collect(eff, b => b.tactic);
  const hasGlobal = eff.globalChemBonus.passing > 0 || eff.globalChemBonus.pace > 0;
  const anything = chemNet !== 0 || hasGlobal || coach.length > 0 || trait.length > 0 || tactic.length > 0;

  const chips = (list: Delta[], color: string) =>
    list.map(({ a, v }) => <Chip key={a} text={`${v > 0 ? '+' : ''}${v} ${ATTR_PT[a]}`} color={color} />);

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
          {chemNet !== 0 && (
            <Row icon="🔗" color={eff.isOOP ? '#EF4444' : '#22C55E'}
              name={`QUÍMICA INDIVIDUAL (${eff.chemScore}/3)${eff.isOOP ? ' · FORA DE POSIÇÃO' : ''}`}>
              <Chip text={`×${eff.chemMult.toFixed(2)}`} color={eff.isOOP ? '#EF4444' : '#22C55E'} />
              <Chip text={`${chemNet > 0 ? '+' : ''}${chemNet} no total`} color={eff.isOOP ? '#EF4444' : '#22C55E'} />
            </Row>
          )}
          {hasGlobal && (
            <Row icon="⭐" name="QUÍMICA DO TIME (global)" color="#C9A84C">
              {eff.globalChemBonus.passing > 0 && <Chip text={`+${eff.globalChemBonus.passing} PAS`} color="#C9A84C" />}
              {eff.globalChemBonus.pace > 0 && <Chip text={`+${eff.globalChemBonus.pace} RIT`} color="#C9A84C" />}
            </Row>
          )}
          {coach.length > 0 && <Row icon="🎯" name="TREINADOR" color="#E8C84A">{chips(coach, '#E8C84A')}</Row>}
          {trait.length > 0 && <Row icon="✨" name="TRAITS" color="#A78BFA">{chips(trait, '#A78BFA')}</Row>}
          {tactic.length > 0 && <Row icon="📋" name="TÁTICA (ESTILO)" color="#4FC3F7">{chips(tactic, '#4FC3F7')}</Row>}
        </div>
      )}
    </div>
  );
}
