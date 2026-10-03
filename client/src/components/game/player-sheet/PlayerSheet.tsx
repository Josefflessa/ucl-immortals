// The player sheet shared by the squad modal (Meu Time) and the read-only report modal:
// identity + effective overall, the eight attributes (tap one to see where every point comes
// from), chemistry/positions summary and the grouped bonus breakdown.
import { useState } from 'react';
import { POS_PT, effectiveSecondaries, getRarityColor } from '@shared/game/gameData';
import { getEvolutionLevel } from '@shared/game/gameEngine';
import { canonicalClubName } from '@shared/game/crests';
import PlayerPortrait from '../PlayerPortrait';
import BuffBreakdown from '../BuffBreakdown';
import { ATTR_LONG, ATTR_SHORT, type PlayerSheetModel, type SheetAttr } from './playerSheetModel';

const FONT = { fontFamily: 'var(--font-game), sans-serif' } as const;
const DISPLAY = { fontFamily: 'var(--font-display), sans-serif' } as const;

export default function PlayerSheet({ model, collapsibleBreakdown = false }: { model: PlayerSheetModel; collapsibleBreakdown?: boolean }) {
  const [selected, setSelected] = useState<SheetAttr | null>(null);
  const { player, eff, chem } = model;
  const rarity = getRarityColor(player.rarity);
  const evolutionLevel = getEvolutionLevel(player);
  const selectedStat = selected ? model.stats.find(s => s.attr === selected) ?? null : null;
  const anyDelta = model.stats.some(s => s.delta !== 0);

  return (
    <div className="overflow-hidden rounded-xl" style={{ background: 'rgba(7,7,15,.82)', border: `1px solid ${rarity}33` }}>
      {/* Identity + overall */}
      <div className="flex items-center gap-4 p-4">
        <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl" style={{ background: '#10101d', border: `2px solid ${rarity}` }}>
          <PlayerPortrait playerId={player.id} photoUrl={player.photoUrl} alt={player.shortName} className="h-full w-full object-cover"
            style={{ objectPosition: 'center top', scale: '1.2' }}
            fallback={<span className="text-2xl" style={{ color: rarity }}>⚽</span>} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded px-2 py-0.5 text-[12px] font-black" style={{ background: '#1c1c2e', color: 'var(--ui-brand)', ...FONT }}>
              {model.isStarter ? POS_PT[model.formationRole] ?? model.formationRole : 'RESERVA'}
            </span>
            {model.fit === 'off' && <span className="rounded px-2 py-0.5 text-[12px] font-black" style={{ background: '#EF444422', color: 'var(--ui-danger)', border: '1px solid #EF444444', ...FONT }}>⚠️ FORA DE POSIÇÃO · −15%</span>}
            {model.fit === 'secondary' && <span className="whitespace-nowrap rounded px-2 py-0.5 text-[12px] font-black" style={{ background: '#F59E0B22', color: '#F59E0B', border: '1px solid #F59E0B55', ...FONT }}>🔁 2ª POSIÇÃO · −5%</span>}
            {evolutionLevel > 0 && <span className="rounded px-2 py-0.5 text-[12px] font-black leading-none" style={{ background: 'linear-gradient(90deg,#0a7a2f,var(--ui-success))', color: '#04120a', letterSpacing: '0.06em' }}>⭐ NÍVEL {evolutionLevel}</span>}
          </div>
          <div className="truncate text-xl font-black uppercase text-white" style={DISPLAY}>{player.shortName}</div>
          <div className="truncate text-xs text-[var(--ui-text-muted)]" style={FONT}>{canonicalClubName(player.club)} · {player.nation}</div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-[12px] font-bold text-[var(--ui-text-faint)]" style={FONT}>GERAL EFETIVO</div>
          <div className="flex items-baseline justify-end gap-1.5">
            {model.overallDelta !== 0 && <span className="text-xs font-bold" style={{ color: model.overallDelta > 0 ? 'var(--ui-success)' : 'var(--ui-danger)', ...FONT }}>{model.overallDelta > 0 ? '+' : ''}{model.overallDelta}</span>}
            <span className="text-3xl font-black leading-none text-white" style={DISPLAY}>{eff.overall}</span>
          </div>
          <div className="mt-1 text-[12px] font-bold text-[var(--ui-text-muted)]" style={FONT}>CARTA {model.originalOverall}</div>
        </div>
      </div>

      {/* Attributes — each one opens its sources */}
      <div className="grid grid-cols-4 border-t" style={{ borderColor: '#161626' }} role="group" aria-label="Atributos efetivos">
        {model.stats.map((s, i) => {
          const color = s.delta > 0 ? '#22C55E' : s.delta < 0 ? '#EF4444' : '#E8D080';
          const active = selected === s.attr;
          return (
            <button key={s.attr} type="button" onClick={() => setSelected(active ? null : s.attr)} aria-pressed={active}
              title={`${ATTR_LONG[s.attr]}: ver de onde vem cada ponto`}
              className={`flex flex-col items-center py-3 transition-colors hover:bg-white/5 ${(i + 1) % 4 === 0 ? '' : 'border-r'} ${i < 4 ? 'border-b' : ''}`}
              style={{ borderColor: '#161626', background: active ? 'rgba(201,168,76,.12)' : undefined, boxShadow: active ? 'inset 0 -2px 0 var(--ui-brand)' : undefined }}>
              <span className="text-[12px] font-bold tracking-wider text-[var(--ui-text-faint)]" style={FONT}>{ATTR_SHORT[s.attr]}</span>
              <span className="text-lg font-black" style={{ color, ...FONT }}>{s.value}</span>
              <span className="text-[12px] font-bold" style={{ color, ...FONT }}>{s.delta !== 0 ? `${s.delta > 0 ? '+' : ''}${s.delta}` : ' '}</span>
            </button>
          );
        })}
      </div>

      {selectedStat ? (
        <div className="border-t px-4 py-3" style={{ borderColor: '#161626', background: '#0b0b14' }} aria-live="polite">
          <div className="flex items-center justify-between text-[12px] font-black tracking-widest" style={FONT}>
            <span className="text-[var(--ui-text-soft)]">{ATTR_LONG[selectedStat.attr].toUpperCase()}</span>
            <button type="button" onClick={() => setSelected(null)} className="text-[var(--ui-text-muted)] hover:text-white">Fechar ✕</button>
          </div>
          <dl className="mt-2 space-y-1 text-[13px]" style={FONT}>
            <div className="flex justify-between gap-3 text-[var(--ui-text-muted)]"><dt>Valor da carta</dt><dd className="tabular-nums">{selectedStat.base}</dd></div>
            {selectedStat.sources.map(src => (
              <div key={src.key} className="flex justify-between gap-3">
                <dt className="min-w-0 truncate text-[var(--ui-text-soft)]"><span aria-hidden="true">{src.icon}</span> {src.label}</dt>
                <dd className="font-black tabular-nums" style={{ color: src.value > 0 ? '#22C55E' : '#EF4444' }}>{src.value > 0 ? '+' : ''}{src.value}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-3 border-t pt-1 font-black text-white" style={{ borderColor: '#1c1c2c' }}><dt>Total</dt><dd className="tabular-nums">{selectedStat.value}</dd></div>
          </dl>
        </div>
      ) : anyDelta ? (
        <div className="border-t px-4 py-2 text-[12px] text-[var(--ui-text-muted)]" style={{ borderColor: '#161626', ...FONT }}>
          Toque em um atributo para ver de onde vem cada ponto.
        </div>
      ) : null}

      {/* Chemistry + positions summary */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3" style={{ borderColor: '#161626' }}>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold tracking-wider text-[var(--ui-text-faint)]" style={FONT}>QUÍMICA INDIVIDUAL</span>
          {chem ? (
            <>
              <div className="flex gap-1" aria-hidden="true">
                {[0, 1, 2].map(i => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: i < chem.score ? 'var(--ui-success)' : '#1a1a2e', boxShadow: i < chem.score ? '0 0 5px var(--ui-success)' : 'none', border: '1px solid rgba(255,255,255,.1)' }} />)}
              </div>
              <span className="text-[12px] font-black text-white" style={FONT}>{chem.score}/3</span>
            </>
          ) : <span className="text-[12px] font-bold text-[var(--ui-text-muted)]" style={FONT}>só para titulares</span>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <span className="text-[12px] font-bold tracking-wider text-[var(--ui-text-faint)]" style={FONT}>JOGA EM:</span>
          <span className="rounded px-1.5 py-0.5 text-[12px] font-black" style={{ background: '#1c1c2e', color: 'var(--ui-brand)', ...FONT }}>{POS_PT[player.position] ?? player.position}</span>
          {effectiveSecondaries(player).map(pos => (
            <span key={pos} className="rounded px-1.5 py-0.5 text-[12px] font-bold" style={{ background: '#12121c', color: 'var(--ui-text-muted)', border: '1px solid var(--ui-line)', ...FONT }}>{POS_PT[pos] ?? pos}</span>
          ))}
        </div>
      </div>

      <BuffBreakdown model={model} collapsible={collapsibleBreakdown} />
    </div>
  );
}
