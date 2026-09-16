// UCL Immortals — Formation selector
// Lets the manager pick / change the team's formation (post-draft and between
// matches in MEU TIME). Shows, in plain language, what each shape does in a match —
// derived from formationProfile so the UI matches the actual engine behaviour.

import { useState } from 'react';
import { FORMATIONS } from '../../lib/gameData';
import { formationProfile } from '../../lib/gameEngine';
import ImpactMeter from './ImpactMeter';
import { ChoiceCard } from '../../design-system';
import FormationPreviewModal, { FormationInfoButton } from './FormationPreviewModal';

interface Tag { label: string; color: string; }

// Turn the numeric formation profile into readable trait chips.
function profileTags(id: string): Tag[] {
  const p = formationProfile(id);
  const tags: Tag[] = [];
  if (p.attack > 0) tags.push({ label: 'Mais perigo', color: '#EF4444' });
  else if (p.attack < 0) tags.push({ label: 'Menos perigo', color: '#4FC3F7' });
  if (p.defense > 0) tags.push({ label: 'Sólida atrás', color: '#22C55E' });
  else if (p.defense < 0) tags.push({ label: 'Cede perigo', color: '#F97316' });
  if (p.control > 0) tags.push({ label: 'Mais volume', color: '#A78BFA' });
  else if (p.control < 0) tags.push({ label: 'Menos volume', color: '#64748B' });
  if (p.cross < 0) tags.push({ label: 'Jogo central', color: '#9AA8C8' });
  else if (p.attack >= 1) tags.push({ label: 'Usa os lados', color: '#9AA8C8' });
  return tags;
}

const Chip = ({ tag }: { tag: Tag }) => (
  <span className="whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-black"
    style={{ background: `${tag.color}22`, color: tag.color, border: `1px solid ${tag.color}44`, fontFamily: 'Rajdhani, sans-serif' }}>
    {tag.label}
  </span>
);

interface Props { value: string | undefined; onChange: (id: string) => void; }

export default function FormationSelector({ value, onChange }: Props) {
  const active = FORMATIONS.find(f => f.id === value) ?? FORMATIONS[0];
  const [previewFormationId, setPreviewFormationId] = useState<string | null>(null);
  const previewFormation = FORMATIONS.find(f => f.id === previewFormationId) ?? null;

  return (
    <div className="ui-panel p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>
          FORMAÇÃO
        </span>
        <span className="text-xs font-bold" style={{ color: '#7A7A8A', fontFamily: 'Rajdhani, sans-serif' }}>
          ESQUEMA TÁTICO
        </span>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-pretty" style={{ color: '#A7A7B8', fontFamily: 'Rajdhani, sans-serif' }}>
        A formação organiza o time e inclina três eixos: <b style={{ color: '#FFF' }}>controle</b> cria volume,
        <b style={{ color: '#FFF' }}> ataque</b> torna as chances mais perigosas e <b style={{ color: '#FFF' }}>defesa</b> reduz o perigo adversário.
        Trocar também reposiciona seus jogadores.
      </p>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {FORMATIONS.map((f) => {
          const isActive = active.id === f.id;
          return (
            <div key={f.id} className="relative h-full">
              <ChoiceCard
                selected={isActive}
                onClick={() => onChange(f.id)}
                title={`${f.name}: perfil de controle, ataque e defesa`}
                className="h-full px-3 py-3 pr-11"
              >
                <div className="text-base font-black tracking-wide" style={{ fontFamily: 'Bebas Neue, sans-serif', color: isActive ? '#C9A84C' : '#FFF' }}>
                  {f.name}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {profileTags(f.id).slice(0, 2).map((t, i) => <Chip key={i} tag={t} />)}
                </div>
              </ChoiceCard>
              <FormationInfoButton formationName={f.name} onClick={() => setPreviewFormationId(f.id)} />
            </div>
          );
        })}
      </div>

      {/* Active formation profile */}
      <div className="ui-panel ui-panel--inset mt-3 px-3 py-3 text-sm">
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <span className="text-base font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>{active.name}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#7A7A8A', fontFamily: 'Rajdhani, sans-serif' }}>
            Perfil no jogo
          </span>
        </div>
        <ImpactMeter profile={formationProfile(active.id)} />
      </div>

      <FormationPreviewModal
        formation={previewFormation}
        open={previewFormation !== null}
        onOpenChange={open => { if (!open) setPreviewFormationId(null); }}
      />
    </div>
  );
}
