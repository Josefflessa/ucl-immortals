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
  <span className="whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-black"
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
    <div className="space-y-3" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
      <div className="rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--ui-text-faint)]">Formação atual</div>
            <div className="mt-0.5 font-display text-xl leading-none tracking-wide text-[var(--ui-brand-strong)]">{active.name}</div>
          </div>
        </div>
        <p className="mt-2 text-xs leading-snug text-[var(--ui-text-muted)]">
          A troca reposiciona os jogadores. As etiquetas resumem o impacto de cada esquema.
        </p>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
          <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--ui-text-soft)]">Escolha a formação</span>
          <span className="text-[10px] font-bold text-[var(--ui-text-faint)]">ⓘ Ver posições</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {FORMATIONS.map((f) => {
          const isActive = active.id === f.id;
          return (
            <div key={f.id} className="relative h-full">
              <ChoiceCard
                selected={isActive}
                onClick={() => onChange(f.id)}
                title={`${f.name}: perfil de controle, ataque e defesa`}
                className="h-full px-2.5 py-2.5 pr-10"
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
      </div>

      <div className="rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] px-3 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--ui-text-soft)]">Impacto no jogo</span>
          <span className="font-display text-base tracking-wide text-[var(--ui-brand-strong)]">{active.name}</span>
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
