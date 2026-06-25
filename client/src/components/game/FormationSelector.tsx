// UCL Immortals — Formation selector
// Lets the manager pick / change the team's formation (post-draft and between
// matches in MEU TIME). Shows, in plain language, what each shape does in a match —
// derived from formationProfile so the UI matches the actual engine behaviour.

import { FORMATIONS } from '../../lib/gameData';
import { formationProfile } from '../../lib/gameEngine';

interface Tag { label: string; color: string; }

// Turn the numeric formation profile into readable trait chips.
function profileTags(id: string): Tag[] {
  const p = formationProfile(id);
  const tags: Tag[] = [];
  if (p.attack > 0) tags.push({ label: 'Ofensiva', color: '#EF4444' });
  else if (p.attack < 0) tags.push({ label: 'Cautelosa', color: '#4FC3F7' });
  if (p.defense > 0) tags.push({ label: 'Sólida atrás', color: '#22C55E' });
  else if (p.defense < 0) tags.push({ label: 'Frágil atrás', color: '#F97316' });
  if (p.control > 0) tags.push({ label: 'Dona do meio', color: '#A78BFA' });
  if (p.cross < 0) tags.push({ label: 'Jogo central', color: '#9AA8C8' });
  else if (p.attack >= 1) tags.push({ label: 'Usa os lados', color: '#9AA8C8' });
  return tags;
}

const Chip = ({ tag }: { tag: Tag }) => (
  <span className="text-[9px] font-black px-1.5 py-0.5 rounded whitespace-nowrap"
    style={{ background: `${tag.color}22`, color: tag.color, border: `1px solid ${tag.color}44`, fontFamily: 'Rajdhani, sans-serif' }}>
    {tag.label}
  </span>
);

interface Props { value: string | undefined; onChange: (id: string) => void; }

export default function FormationSelector({ value, onChange }: Props) {
  const active = FORMATIONS.find(f => f.id === value) ?? FORMATIONS[0];

  return (
    <div className="rounded-xl p-4" style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>
          FORMAÇÃO
        </span>
        <span className="text-[10px] font-bold" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
          ESQUEMA TÁTICO
        </span>
      </div>

      <p className="text-[11px] mb-3" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
        📐 A formação muda <b style={{ color: '#FFF' }}>como o time cria e sofre chances</b>. Trocar reposiciona
        seus jogadores — cuidado com quem ficar <b style={{ color: '#EF4444' }}>fora de posição</b>.
      </p>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {FORMATIONS.map((f) => {
          const isActive = active.id === f.id;
          return (
            <button
              key={f.id}
              onClick={() => onChange(f.id)}
              title={f.strengths.join(' · ')}
              className="text-left rounded-lg px-2.5 py-2 transition-all"
              style={{
                fontFamily: 'Rajdhani, sans-serif',
                background: isActive ? '#14142A' : '#0A0A14',
                border: `1px solid ${isActive ? '#C9A84C' : '#1A1A2A'}`,
              }}
            >
              <div className="text-sm font-black tracking-wide" style={{ fontFamily: 'Bebas Neue, sans-serif', color: isActive ? '#C9A84C' : '#FFF' }}>
                {f.name}
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {profileTags(f.id).slice(0, 2).map((t, i) => <Chip key={i} tag={t} />)}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active formation explanation */}
      <div className="mt-3 rounded-lg px-3 py-2.5 text-[11px]" style={{ background: '#0A0A14', fontFamily: 'Rajdhani, sans-serif' }}>
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="text-base font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>{active.name}</span>
          {profileTags(active.id).map((t, i) => <Chip key={i} tag={t} />)}
        </div>
        <div style={{ color: '#22C55E' }}>✓ {active.strengths.join(' · ')}</div>
        <div className="mt-0.5" style={{ color: '#EF4444' }}>✗ {active.weaknesses.join(' · ')}</div>
      </div>
    </div>
  );
}
