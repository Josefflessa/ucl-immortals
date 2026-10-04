// UCL Immortals — tournament format selection

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Bot,
  CalendarDays,
  CheckCircle2,
  GitBranch,
  Info,
  Settings2,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useGame } from '../contexts/GameContext';
import CompetitionExitControl from '../components/game/CompetitionExitControl';
import {
  COMPETITION_FORMAT_PRESETS,
  MAX_BOT_TEAMS,
  MAX_COMPETITION_TEAMS,
  MAX_ONLINE_PLAYERS,
  MIN_COMPETITION_TEAMS,
  MIN_QUALIFIED_TEAMS,
  createCompetitionFormat,
  normalizeCompetitionFormat,
  validateCompetitionFormat,
  type CompetitionFormat,
  type CompetitionFormatId,
  type LeagueLegs,
} from '@shared/game/competition';
import { AppShell, Button, ChoiceCard, Input, PageContainer, SectionHeader, TopBar } from '../design-system';

const labelClass = 'text-[12px] font-bold uppercase tracking-[0.11em] text-[var(--ui-text-muted)]';
const inputClass = 'ui-input mt-2 w-full text-left sm:text-center';

type NumberFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: string) => void;
  helper?: string;
  className?: string;
};

function NumberField({ label, value, min, max, onChange, helper, className = '' }: NumberFieldProps) {
  const safeMax = Math.max(min, max);
  const invalid = !Number.isInteger(value) || value < min || value > safeMax;

  return (
    <label className={`block ${className}`}>
      <span className="flex items-center justify-between gap-2">
        <span className={labelClass}>{label}</span>
        <span className="text-[12px] font-medium normal-case tracking-normal text-[var(--ui-text-faint)]">{min}–{safeMax}</span>
      </span>
      <Input
        type="number"
        min={min}
        max={safeMax}
        step={1}
        value={value}
        onChange={event => onChange(event.target.value)}
        onBlur={() => {
          const numericValue = Number(value);
          const normalizedValue = Number.isFinite(numericValue) ? Math.trunc(numericValue) : min;
          onChange(String(Math.min(safeMax, Math.max(min, normalizedValue))));
        }}
        aria-invalid={invalid || undefined}
        className={`${inputClass} ${invalid ? 'border-[var(--ui-danger)]' : ''}`}
      />
      <span className={`mt-1 block text-[12px] leading-relaxed ${invalid ? 'text-[var(--ui-danger)]' : 'text-[var(--ui-text-faint)]'}`}>
        {invalid ? `Use um número inteiro entre ${min} e ${safeMax}.` : helper ?? `Permitido: ${min} a ${safeMax}.`}
      </span>
    </label>
  );
}

function ConfigSection({ index, icon, eyebrow, title, description, children }: { index: string; icon: ReactNode; eyebrow: string; title: string; description: string; children: ReactNode }) {
  return (
    <section className="ui-panel overflow-hidden p-0">
      <div className="border-b border-[var(--ui-line-subtle)] bg-[var(--ui-panel-inset)] px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/33 bg-primary/7 text-primary" aria-hidden="true">{icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[12px] font-black tracking-[0.16em] text-primary">{index}</span>
              <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--ui-text-faint)]">{eyebrow}</span>
            </div>
            <h2 className="mt-1 text-lg font-black text-white">{title}</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--ui-text-muted)]">{description}</p>
          </div>
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function SummaryMetric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-[12px] font-bold uppercase text-[var(--ui-text-faint)]">
          <span className="shrink-0 text-primary" aria-hidden="true">{icon}</span>
          <span className="truncate">{label}</span>
        </div>
        <div className="shrink-0 text-sm font-black leading-tight text-right text-white text-balance tabular-nums">{value}</div>
      </div>
      <div className="mt-0.5 pl-[22px] text-[12px] leading-tight text-[var(--ui-text-faint)] text-pretty">{detail}</div>
    </div>
  );
}

function SummaryRow({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail?: string }) {
  return (
    <div className="flex items-start gap-2 py-2 first:pt-0 last:pb-0">
      <span className="flex size-6 shrink-0 items-center justify-center text-[var(--ui-text-muted)]" aria-hidden="true">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-xs font-bold text-[var(--ui-text-muted)]">{label}</span>
          <span className="text-xs font-black text-white text-right tabular-nums">{value}</span>
        </div>
        {detail && <div className="mt-0.5 text-[12px] leading-tight text-[var(--ui-text-faint)] text-pretty">{detail}</div>}
      </div>
    </div>
  );
}

export default function TournamentFormatPage() {
  const { state, dispatch } = useGame();
  const isOnlineRoomCreation = state.onlineSetupIntent === 'create';
  const [format, setFormat] = useState<CompetitionFormat>(() => normalizeCompetitionFormat(state.competitionFormat));
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const selectPreset = (id: CompetitionFormatId) => {
    // Clicking the already-selected preset must not erase its advanced options.
    // This also keeps a double click on a customized preset from resetting it.
    if (format.id === id) return;
    setFormat(createCompetitionFormat(id));
    setError(null);
  };

  const continueWithPreset = (id: CompetitionFormatId) => {
    const nextFormat = format.id === id ? format : createCompetitionFormat(id);
    setFormat(nextFormat);
    setError(null);
    handleContinue(nextFormat);
  };

  const setNumber = (key: keyof CompetitionFormat, raw: string) => {
    const value = Number(raw);
    setFormat(previous => {
      const next = { ...previous, [key]: Number.isFinite(value) ? value : 0 };
      if (key === 'teamCount' && next.id === 'league') {
        next.leagueRounds = next.leagueLegs * Math.max(1, next.teamCount - 1);
        next.rewards = { ...next.rewards, reinforcementUntilRound: next.leagueRounds };
      }
      return next;
    });
    setError(null);
  };

  const setLeagueLegs = (leagueLegs: LeagueLegs) => {
    setFormat(previous => ({
      ...previous,
      leagueLegs,
      leagueRounds: leagueLegs * Math.max(1, previous.teamCount - 1),
      rewards: {
        ...previous.rewards,
        reinforcementUntilRound: leagueLegs * Math.max(1, previous.teamCount - 1),
      },
    }));
    setError(null);
  };

  const setGroupNumber = (key: 'groupCount' | 'teamsPerGroup' | 'groupRounds' | 'qualifiedPerGroup', raw: string) => {
    const value = Number(raw);
    setFormat(previous => {
      const next = { ...previous, [key]: Number.isFinite(value) ? value : 0 };
      if (key === 'groupCount' || key === 'teamsPerGroup') next.teamCount = next.groupCount * next.teamsPerGroup;
      if (key === 'groupCount' || key === 'qualifiedPerGroup') next.qualifiedTeams = next.groupCount * next.qualifiedPerGroup;
      if (key === 'groupRounds') next.leagueRounds = next.groupRounds;
      return next;
    });
    setError(null);
  };

  const handleContinue = (formatOverride?: CompetitionFormat) => {
    const nextFormat = formatOverride ?? format;
    const validationError = validateCompetitionFormat(nextFormat);
    if (validationError) {
      setError(validationError);
      return;
    }
    dispatch({ type: 'SET_COMPETITION_FORMAT', format: nextFormat });
    dispatch({ type: 'SET_PHASE', phase: 'setup' });
  };

  const preset = COMPETITION_FORMAT_PRESETS[format.id];
  const isGroups = format.id === 'groups_knockout';
  const hasKnockout = format.id !== 'league';
  const validationError = validateCompetitionFormat(format);
  const calendarValue = format.id === 'league'
    ? `${format.leagueRounds} rodadas`
    : format.id === 'groups_knockout'
      ? `${format.groupRounds} rodadas`
      : format.id === 'knockout'
        ? format.knockoutLegs === 2 ? 'Ida e volta' : 'Jogo único'
        : `${format.leagueRounds} rodadas`;
  const calendarDetail = format.id === 'league'
    ? format.leagueLegs === 2 ? 'Todos se enfrentam duas vezes.' : 'Todos se enfrentam uma vez.'
    : format.id === 'groups_knockout'
      ? `${format.groupCount} grupos de ${format.teamsPerGroup} times.`
      : format.id === 'knockout'
        ? 'Eliminação desde a primeira fase.'
        : `${format.qualifiedTeams} times avançam ao mata-mata.`;
  const advancementValue = format.id === 'league'
    ? 'Tabela final'
    : format.id === 'groups_knockout'
      ? `${format.qualifiedTeams} classificados`
      : format.id === 'knockout'
        ? 'Eliminação direta'
        : `${format.qualifiedTeams} classificados`;
  const advancementDetail = format.id === 'league'
    ? 'O campeão é o líder ao fim da liga.'
    : format.id === 'groups_knockout'
      ? `${format.qualifiedPerGroup} por grupo seguem adiante.`
      : format.id === 'knockout'
        ? 'Perdeu, está eliminado.'
        : 'A classificação define o caminho do mata-mata.';
  const finalValue = format.id === 'league'
    ? 'Sem mata-mata'
    : format.finalSingleLeg ? 'Jogo único' : 'Ida e volta';
  const finalDetail = format.id === 'league'
    ? 'Decisão pela tabela.'
    : 'Formato da final.';

  return (
    <AppShell>
      <TopBar right={<CompetitionExitControl />} />
      <PageContainer wide className="flex flex-col gap-6 py-8 sm:py-10">
        <SectionHeader
          title="Formato do torneio"
          description="Escolha um modelo pronto e personalize apenas o que faz sentido para aquela estrutura."
        />

        <div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(Object.values(COMPETITION_FORMAT_PRESETS) as typeof COMPETITION_FORMAT_PRESETS[CompetitionFormatId][]).map(option => {
              const selected = format.id === option.id;
              return (
                <ChoiceCard
                  key={option.id}
                  selected={selected}
                  onClick={() => selectPreset(option.id)}
                  onDoubleClick={() => continueWithPreset(option.id)}
                  title="Clique duas vezes para escolher e continuar"
                  className="ui-choice min-h-[164px] p-4 text-left transition-transform hover:-translate-y-0.5"
                  style={{
                    background: selected ? '#171523' : '#0F0F1A',
                    border: `1px solid ${selected ? '#C9A84C' : '#242436'}`,
                    boxShadow: selected ? '0 0 0 1px rgba(201,168,76,0.18)' : 'none',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-3xl" aria-hidden="true">{option.icon}</span>
                    {selected && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-sm font-black text-[#080810]">✓</span>}
                  </div>
                  <div className="mt-3 font-black tracking-wide text-white" style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 22 }}>{option.name.toUpperCase()}</div>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--ui-text-muted)]">{option.shortDescription}</p>
                </ChoiceCard>
              );
            })}
          </div>
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen(open => !open)}
            className="flex items-center gap-2 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-panel-inset)] px-4 py-3 text-xs font-black uppercase tracking-wider text-[var(--ui-text-muted)] transition-colors hover:border-primary/53 hover:text-brand-strong"
          >
            <Settings2 size={15} />
            {advancedOpen ? 'Ocultar opções avançadas' : 'Ver opções avançadas'}
          </button>
        </div>

        <div className={advancedOpen ? 'grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.28fr)_minmax(280px,0.72fr)]' : 'block'}>
          {advancedOpen && (
          <motion.div key={format.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
            <ConfigSection index="01" eyebrow="BASE DO FORMATO" title={preset.name} description={preset.description} icon={<Trophy size={17} />}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {!isGroups && (
                  <NumberField
                    label="Times no torneio"
                    value={format.teamCount}
                    min={format.id === 'league_knockout' ? MIN_QUALIFIED_TEAMS : format.id === 'knockout' ? 4 : MIN_COMPETITION_TEAMS}
                    max={format.id === 'knockout' ? 16 : MAX_COMPETITION_TEAMS}
                    onChange={value => setNumber('teamCount', value)}
                    helper={format.id === 'knockout' ? 'O mata-mata direto aceita 4, 8 ou 16.' : 'O jogo completa o total com bots quando necessário.'}
                  />
                )}

                {format.id === 'league' && (
                  <div className="sm:col-span-2">
                    <div className={labelClass}>Formato da liga</div>
                    <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {([
                        [1, 'Turno único', 'Cada adversário é enfrentado uma vez.'],
                        [2, 'Ida e volta', 'Cada adversário é enfrentado duas vezes, com o mando invertido.'],
                      ] as const).map(([legs, title, description]) => (
                        <ChoiceCard
                          key={legs}
                          selected={format.leagueLegs === legs}
                          onClick={() => setLeagueLegs(legs)}
                          className="rounded-xl border p-4 text-left transition-colors"
                          style={{ borderColor: format.leagueLegs === legs ? 'var(--ui-brand)' : '#242436', background: format.leagueLegs === legs ? '#C9A84C12' : 'var(--ui-surface-1)' }}
                        >
                          <div className="flex items-center justify-between gap-2"><div className="text-sm font-bold text-white">{title}</div>{format.leagueLegs === legs && <CheckCircle2 size={16} className="text-primary" />}</div>
                          <div className="mt-1 text-[13px] leading-relaxed text-[var(--ui-text-muted)]">{description}</div>
                          <div className="mt-2 text-xs font-black text-primary">{legs * Math.max(1, format.teamCount - 1)} rodadas</div>
                        </ChoiceCard>
                      ))}
                    </div>
                  </div>
                )}

                {format.id === 'league_knockout' && (
                  <NumberField
                    label="Rodadas da fase de liga"
                    value={format.leagueRounds}
                    min={1}
                    max={Math.max(1, format.teamCount - 1)}
                    onChange={value => setNumber('leagueRounds', value)}
                    helper="Uma rodada representa uma sequência de partidas contra os adversários."
                  />
                )}

                {format.id === 'league_knockout' && (
                  <NumberField
                    label="Times classificados"
                    value={format.qualifiedTeams}
                    min={MIN_QUALIFIED_TEAMS}
                    max={Math.min(24, Math.max(MIN_QUALIFIED_TEAMS, format.teamCount))}
                    onChange={value => setNumber('qualifiedTeams', value)}
                    helper="Entre 16 e 24 avançam; acima de 16 existe playoff antes das oitavas."
                  />
                )}

                {isGroups && (
                  <>
                    <NumberField label="Quantidade de grupos" value={format.groupCount} min={2} max={12} onChange={value => setGroupNumber('groupCount', value)} helper="O total de times é calculado automaticamente." />
                    <NumberField label="Times por grupo" value={format.teamsPerGroup} min={2} max={8} onChange={value => setGroupNumber('teamsPerGroup', value)} helper="Cada grupo joga dentro da própria chave." />
                    <NumberField label="Rodadas dos grupos" value={format.groupRounds} min={1} max={Math.max(1, format.teamsPerGroup - 1)} onChange={value => setGroupNumber('groupRounds', value)} helper="Não pode superar o número de confrontos possíveis do grupo." />
                    <NumberField label="Classificados por grupo" value={format.qualifiedPerGroup} min={1} max={Math.max(1, format.teamsPerGroup)} onChange={value => setGroupNumber('qualifiedPerGroup', value)} helper="O mata-mata precisa receber exatamente 16 times." />
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs leading-relaxed text-[var(--ui-text-muted)] sm:col-span-2">
                      <div className="flex items-center gap-2 font-bold text-primary"><GitBranch size={14} /> Fechamento automático da fase</div>
                      <p className="mt-2"><strong className="text-white">{format.teamCount} times</strong> serão distribuídos em <strong className="text-white">{format.groupCount} grupos</strong>; <strong className="text-white">{format.qualifiedTeams}</strong> avançam para o mata-mata.</p>
                      <p className="mt-1 text-[13px] text-[var(--ui-text-faint)]">Para este modelo, o jogo valida se o total fecha os grupos e se a classificação forma as oitavas.</p>
                    </div>
                  </>
                )}
              </div>
              {format.id === 'league' && <div className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-panel-inset)] p-3 text-[13px] leading-relaxed text-[var(--ui-text-muted)]"><Info size={15} className="mt-0.5 shrink-0 text-primary" /> Este formato termina na tabela: não há classificação para mata-mata.</div>}
            </ConfigSection>

            {hasKnockout && (
              <ConfigSection index="02" eyebrow="FASE ELIMINATÓRIA" title="Como serão os confrontos?" description="Escolha o ritmo das fases eliminatórias e personalize o formato da final." icon={<Swords size={17} />}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {([1, 2] as const).map(legs => (
                    <ChoiceCard
                      key={legs}
                      selected={format.knockoutLegs === legs}
                      onClick={() => { setFormat(previous => ({ ...previous, knockoutLegs: legs })); setError(null); }}
                      className="rounded-xl border p-4 text-left transition-colors"
                      style={{ borderColor: format.knockoutLegs === legs ? 'var(--ui-brand)' : '#242436', background: format.knockoutLegs === legs ? '#C9A84C12' : 'var(--ui-surface-1)' }}
                    >
                      <div className="flex items-center justify-between gap-2"><div className="text-sm font-bold text-white">{legs === 1 ? 'Jogo único' : 'Ida e volta'}</div>{format.knockoutLegs === legs && <CheckCircle2 size={16} className="text-primary" />}</div>
                      <div className="mt-1 text-[13px] leading-relaxed text-[var(--ui-text-muted)]">{legs === 1 ? 'Mais rápido, ideal para torneios compactos.' : 'A soma dos dois jogos define quem avança.'}</div>
                    </ChoiceCard>
                  ))}
                </div>
                <div className="mt-5 border-t border-[var(--ui-line-subtle)] pt-5">
                  <div className="text-sm font-bold text-white">Formato da final</div>
                  <p className="mt-1 text-[13px] leading-relaxed text-[var(--ui-text-muted)]">Jogo único mantém a final neutra; ida e volta faz cada finalista receber um jogo em casa e decide pelo agregado.</p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {([
                      [true, 'Jogo único', 'Final em campo neutro, com prorrogação e pênaltis se necessário.'],
                      [false, 'Ida e volta', 'Cada finalista manda um jogo; empate no agregado vai à prorrogação e pênaltis na volta.'],
                    ] as const).map(([singleLeg, title, description]) => (
                      <ChoiceCard key={title} selected={format.finalSingleLeg === singleLeg} onClick={() => { setFormat(previous => ({ ...previous, finalSingleLeg: singleLeg })); setError(null); }} className="rounded-xl border p-4 text-left transition-colors" style={{ borderColor: format.finalSingleLeg === singleLeg ? 'var(--ui-brand)' : '#242436', background: format.finalSingleLeg === singleLeg ? '#C9A84C12' : 'var(--ui-surface-1)' }}>
                        <div className="flex items-center justify-between gap-2"><div className="text-sm font-bold text-white">{title}</div>{format.finalSingleLeg === singleLeg && <CheckCircle2 size={16} className="text-primary" />}</div>
                        <div className="mt-1 text-[13px] leading-relaxed text-[var(--ui-text-muted)]">{description}</div>
                      </ChoiceCard>
                    ))}
                  </div>
                </div>
              </ConfigSection>
            )}

          </motion.div>
          )}

          <aside className={advancedOpen ? 'flex flex-col gap-4 lg:sticky lg:top-24' : ''}>
            <div className="ui-panel overflow-hidden p-0">
              <div className="border-b border-[var(--ui-line-subtle)] bg-[var(--ui-panel-inset)] px-4 py-4 sm:px-5">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/27 bg-primary/7 text-xl" aria-hidden="true">{preset.icon}</div>
                  <div className="min-w-0">
                    <div className="ui-section-label">RESUMO DO TORNEIO</div>
                    <h2 className="mt-0.5 text-lg font-black leading-tight text-white text-balance">{preset.name}</h2>
                    <p className="mt-0.5 text-xs leading-tight text-[var(--ui-text-muted)] text-pretty">{preset.shortDescription}</p>
                  </div>
                </div>
              </div>
              <div className="p-3 sm:p-4">
                <div className="grid grid-cols-2 gap-4 border-b border-[var(--ui-line-subtle)] pb-3">
                  <SummaryMetric icon={<Users size={14} />} label="Participantes" value={`${format.teamCount} times`} detail="Total da competição." />
                  <SummaryMetric icon={<Bot size={14} />} label="Bots" value={isOnlineRoomCreation ? 'Automático' : `${Math.max(0, format.teamCount - 1)}`} detail={isOnlineRoomCreation ? 'Preenchem as vagas restantes.' : 'Além do seu time.'} />
                </div>

                <div className="mt-3">
                  <div className="ui-section-label">ESTRUTURA</div>
                  <div className="mt-1.5 divide-y divide-[var(--ui-line-subtle)]">
                    <SummaryRow icon={<CalendarDays size={15} />} label="Calendário" value={calendarValue} detail={calendarDetail} />
                    <SummaryRow icon={<GitBranch size={15} />} label="Classificação" value={advancementValue} detail={advancementDetail} />
                    <SummaryRow icon={<Swords size={15} />} label="Final" value={finalValue} detail={finalDetail} />
                  </div>
                </div>

                <div className={`mt-3 flex items-center gap-1.5 border-t pt-2 text-[12px] leading-tight ${validationError ? 'border-[var(--ui-danger)] text-[var(--ui-danger)]' : 'border-[var(--ui-success)] text-[var(--ui-success)]'}`} role="status">
                  {validationError ? <AlertTriangle size={13} className="shrink-0" /> : <CheckCircle2 size={13} className="shrink-0" />}
                  <div className="flex min-w-0 flex-wrap gap-x-1.5"><strong>{validationError ? 'Revise a configuração:' : 'Configuração válida:'}</strong><span className="text-pretty">{validationError ?? 'Todos os limites e formatos estão coerentes.'}</span></div>
                </div>
              </div>
            </div>

            {advancedOpen && (
              <div className="ui-panel ui-panel--inset p-5">
                <div className="ui-section-label">LIMITES AUTOMÁTICOS</div>
                <div className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[var(--ui-text-muted)]"><Bot size={15} className="mt-0.5 shrink-0 text-primary" /><span><strong className="text-white">Solo:</strong> até {MAX_BOT_TEAMS} bots, completando no máximo {MAX_COMPETITION_TEAMS} times.</span></div>
                <div className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[var(--ui-text-muted)]"><Users size={15} className="mt-0.5 shrink-0 text-primary" /><span><strong className="text-white">Online:</strong> os bots completam o total depois dos jogadores humanos; a sala suporta até {MAX_ONLINE_PLAYERS} pessoas.</span></div>
              </div>
            )}
          </aside>
        </div>

        {error && <div className="flex items-start gap-2 rounded-xl border border-[var(--ui-danger)] bg-[var(--ui-danger)]12 px-4 py-3 text-xs font-bold text-[var(--ui-danger)]" role="alert"><AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}</div>}

        <div className="mt-8 flex gap-3">
          <Button onClick={() => { dispatch({ type: 'SET_ONLINE_SETUP_INTENT', intent: null }); dispatch({ type: 'SET_PHASE', phase: 'menu' }); }} intent="ghost" className="border border-[var(--ui-line-subtle)]">← VOLTAR</Button>
          <Button intent="primary" size="large" onClick={() => handleContinue()} disabled={Boolean(validationError)} className="flex-1">ESCOLHER DIFICULDADE →</Button>
        </div>
      </PageContainer>
    </AppShell>
  );
}
