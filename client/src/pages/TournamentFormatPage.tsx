// UCL Immortals — tournament format selection

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  GitBranch,
  Info,
  Settings2,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useGame } from '../contexts/GameContext';
import {
  COMPETITION_FORMAT_PRESETS,
  MAX_BOT_TEAMS,
  MAX_COMPETITION_TEAMS,
  MAX_ONLINE_PLAYERS,
  MAX_POINTS_PER_RULE,
  MAX_REINFORCEMENT_OPTIONS,
  MIN_COMPETITION_TEAMS,
  MIN_QUALIFIED_TEAMS,
  MIN_REINFORCEMENT_OPTIONS,
  createCompetitionFormat,
  competitionFormatSummary,
  competitionRewardSummary,
  normalizeCompetitionFormat,
  reinforcementWindowLimit,
  validateCompetitionFormat,
  type CompetitionFormat,
  type CompetitionFormatId,
  type ReinforcementMode,
} from '../lib/competition';
import { AppShell, Button, ChoiceCard, Input, PageContainer, SectionHeader, TopBar } from '../design-system';

const labelClass = 'text-[10px] font-bold uppercase tracking-[0.11em] text-[var(--ui-text-muted)]';
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
        <span className="text-[10px] font-medium normal-case tracking-normal text-[var(--ui-text-faint)]">{min}–{safeMax}</span>
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
      <span className={`mt-1 block text-[10px] leading-relaxed ${invalid ? 'text-[var(--ui-danger)]' : 'text-[var(--ui-text-faint)]'}`}>
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
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#C9A84C55] bg-[#C9A84C12] text-[#C9A84C]" aria-hidden="true">{icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[10px] font-black tracking-[0.16em] text-[#C9A84C]">{index}</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ui-text-faint)]">{eyebrow}</span>
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

function ToggleRow({ title, description, enabled, onToggle }: { title: string; description: string; enabled: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-panel-inset)] px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-bold text-white">{title}</div>
        <div className="mt-1 text-[11px] leading-relaxed text-[var(--ui-text-muted)]">{description}</div>
      </div>
      <button
        type="button"
        aria-pressed={enabled}
        onClick={onToggle}
        className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors ${enabled ? 'bg-[#C9A84C] text-[#080810]' : 'bg-[#292936] text-[#A0A0AF]'}`}
      >
        {enabled ? 'Ativo' : 'Off'}
      </button>
    </div>
  );
}

function reinforcementStageOptions(format: CompetitionFormat): Array<{ value: number; label: string }> {
  if (format.id === 'knockout') {
    if (format.teamCount === 4) return [{ value: 1, label: 'Até as semifinais' }];
    if (format.teamCount === 8) return [{ value: 1, label: 'Até as quartas de final' }, { value: 2, label: 'Até as semifinais' }];
    return [{ value: 1, label: 'Até as oitavas de final' }, { value: 2, label: 'Até as quartas de final' }, { value: 3, label: 'Até as semifinais' }];
  }
  if (format.id === 'league_knockout' && format.qualifiedTeams > 16) {
    return [
      { value: 1, label: 'Até o playoff' },
      { value: 2, label: 'Até as oitavas de final' },
      { value: 3, label: 'Até as quartas de final' },
      { value: 4, label: 'Até as semifinais' },
    ];
  }
  if (format.id === 'league_knockout' || format.id === 'groups_knockout') {
    return [
      { value: 2, label: 'Até as oitavas de final' },
      { value: 3, label: 'Até as quartas de final' },
      { value: 4, label: 'Até as semifinais' },
    ];
  }
  return [];
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
    setFormat(previous => ({ ...previous, [key]: Number.isFinite(value) ? value : 0 }));
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

  const setPoints = (key: keyof CompetitionFormat['rewards']['points'], raw: string) => {
    const value = Number(raw);
    setFormat(previous => ({
      ...previous,
      rewards: { ...previous.rewards, points: { ...previous.rewards.points, [key]: Number.isFinite(value) ? value : 0 } },
    }));
    setError(null);
  };

  const setRewardNumber = (key: 'reinforcementUntilRound' | 'reinforcementOptions', raw: string) => {
    const value = Number(raw);
    setFormat(previous => updateRewards(previous, { [key]: Number.isFinite(value) ? value : 0 }));
    setError(null);
  };

  const setMatchSetting = <K extends keyof CompetitionFormat['matchSettings']>(key: K, value: CompetitionFormat['matchSettings'][K]) => {
    setFormat(previous => ({ ...previous, matchSettings: { ...previous.matchSettings, [key]: value } }));
    setError(null);
  };

  const selectReinforcementMode = (mode: ReinforcementMode) => {
    setFormat(previous => {
      const limit = reinforcementWindowLimit(previous, mode);
      const currentWindow = previous.rewards.reinforcementUntilRound ?? 1;
      return updateRewards(previous, {
        reinforcement: mode,
        reinforcementUntilRound: mode === 'off' ? null : Math.min(currentWindow, limit),
      });
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
  const hasLeague = format.id === 'league' || format.id === 'league_knockout';
  const hasKnockout = format.id !== 'league';
  const validationError = validateCompetitionFormat(format);
  const reinforcementLimit = reinforcementWindowLimit(format);
  const isReinforcementEnabled = format.rewards.reinforcement !== 'off';
  const stageOptions = reinforcementStageOptions(format);
  const selectedStageValue = stageOptions.some(option => option.value === format.rewards.reinforcementUntilRound)
    ? format.rewards.reinforcementUntilRound ?? stageOptions[0]?.value ?? 1
    : stageOptions[0]?.value ?? 1;

  return (
    <AppShell>
      <TopBar playerName={state.playerName} />
      <PageContainer wide className="flex flex-col gap-6 py-8 sm:py-10">
        <SectionHeader
          kicker="NOVA COMPETIÇÃO"
          title="Formato do torneio"
          description="Escolha um modelo pronto e personalize apenas o que faz sentido para aquela estrutura. A dificuldade dos bots vem na próxima etapa."
        />

        <div>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <div className="ui-section-label">ESCOLHA UM MODELO</div>
              <p className="mt-1 text-xs text-[var(--ui-text-muted)]">Os presets abaixo já respeitam o que o motor do jogo consegue disputar.</p>
            </div>
            <div className="hidden items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--ui-text-faint)] sm:flex"><Settings2 size={13} /> Personalizável</div>
          </div>
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
                    {selected ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#C9A84C] text-sm font-black text-[#080810]">✓</span> : <span className="rounded-full border border-[var(--ui-line-subtle)] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--ui-text-faint)]">Preset</span>}
                  </div>
                  <div className="mt-3 font-black tracking-wide text-white" style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 22 }}>{option.name.toUpperCase()}</div>
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
            className="flex items-center gap-2 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-panel-inset)] px-4 py-3 text-xs font-black uppercase tracking-wider text-[var(--ui-text-muted)] transition-colors hover:border-[#C9A84C88] hover:text-[#E8C84A]"
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

                {hasLeague && (
                  <NumberField
                    label={format.id === 'league' ? 'Rodadas da liga' : 'Rodadas da fase de liga'}
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
                    <div className="rounded-xl border border-[#C9A84C33] bg-[#C9A84C0D] p-4 text-xs leading-relaxed text-[var(--ui-text-muted)] sm:col-span-2">
                      <div className="flex items-center gap-2 font-bold text-[#C9A84C]"><GitBranch size={14} /> Fechamento automático da fase</div>
                      <p className="mt-2"><strong className="text-white">{format.teamCount} times</strong> serão distribuídos em <strong className="text-white">{format.groupCount} grupos</strong>; <strong className="text-white">{format.qualifiedTeams}</strong> avançam para o mata-mata.</p>
                      <p className="mt-1 text-[11px] text-[var(--ui-text-faint)]">Para este modelo, o jogo valida se o total fecha os grupos e se a classificação forma as oitavas.</p>
                    </div>
                  </>
                )}
              </div>
              {format.id === 'league' && <div className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-panel-inset)] p-3 text-[11px] leading-relaxed text-[var(--ui-text-muted)]"><Info size={15} className="mt-0.5 shrink-0 text-[#C9A84C]" /> Este formato termina na tabela: não há classificação para mata-mata.</div>}
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
                      style={{ borderColor: format.knockoutLegs === legs ? '#C9A84C' : '#242436', background: format.knockoutLegs === legs ? '#C9A84C12' : '#0F0F1A' }}
                    >
                      <div className="flex items-center justify-between gap-2"><div className="text-sm font-bold text-white">{legs === 1 ? 'Jogo único' : 'Ida e volta'}</div>{format.knockoutLegs === legs && <CheckCircle2 size={16} className="text-[#C9A84C]" />}</div>
                      <div className="mt-1 text-[11px] leading-relaxed text-[var(--ui-text-muted)]">{legs === 1 ? 'Mais rápido, ideal para torneios compactos.' : 'A soma dos dois jogos define quem avança.'}</div>
                    </ChoiceCard>
                  ))}
                </div>
                <div className="mt-5 border-t border-[var(--ui-line-subtle)] pt-5">
                  <div className="text-sm font-bold text-white">Formato da final</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--ui-text-muted)]">Jogo único mantém a final neutra; ida e volta faz cada finalista receber um jogo em casa e decide pelo agregado.</p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {([
                      [true, 'Jogo único', 'Final em campo neutro, com prorrogação e pênaltis se necessário.'],
                      [false, 'Ida e volta', 'Cada finalista manda um jogo; empate no agregado vai à prorrogação e pênaltis na volta.'],
                    ] as const).map(([singleLeg, title, description]) => (
                      <ChoiceCard key={title} selected={format.finalSingleLeg === singleLeg} onClick={() => { setFormat(previous => ({ ...previous, finalSingleLeg: singleLeg })); setError(null); }} className="rounded-xl border p-4 text-left transition-colors" style={{ borderColor: format.finalSingleLeg === singleLeg ? '#C9A84C' : '#242436', background: format.finalSingleLeg === singleLeg ? '#C9A84C12' : '#0F0F1A' }}>
                        <div className="flex items-center justify-between gap-2"><div className="text-sm font-bold text-white">{title}</div>{format.finalSingleLeg === singleLeg && <CheckCircle2 size={16} className="text-[#C9A84C]" />}</div>
                        <div className="mt-1 text-[11px] leading-relaxed text-[var(--ui-text-muted)]">{description}</div>
                      </ChoiceCard>
                    ))}
                  </div>
                </div>
              </ConfigSection>
            )}

            <ConfigSection index={hasKnockout ? '03' : '02'} eyebrow="REGRAS DA COMPETIÇÃO" title="Recrutamento e créditos" description="Defina o ritmo das ofertas de recrutamento e os créditos ganhos por desempenho. Essas regras valem só para este torneio." icon={<CircleDollarSign size={17} />}>
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-white"><ShieldCheck size={16} className="text-[#C9A84C]" /> Recrutamento gratuito</div>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--ui-text-muted)]">A oferta aparece para o jogador quando o evento configurado é concluído.</p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {([
                    ['off', 'Sem recrutamento automático', 'A evolução vem apenas da loja.'],
                    ['round', hasLeague ? 'Durante a fase de liga' : isGroups ? 'Durante a fase de grupos' : 'Após cada fase', hasLeague ? 'Uma oferta ao fechar cada rodada da liga.' : isGroups ? 'Uma oferta ao fechar cada rodada do grupo.' : 'Uma oferta ao fechar cada fase.'],
                    ...(hasKnockout ? [['stage', 'Após cada fase eliminatória', 'Uma oferta ao concluir cada bloco eliminatório.'] as const] : []),
                  ] as const).filter(([mode]) => mode !== 'round' || hasLeague || isGroups).map(([mode, title, description]) => (
                    <ChoiceCard key={mode} selected={format.rewards.reinforcement === mode} onClick={() => selectReinforcementMode(mode)} className="rounded-xl border px-3 py-3 text-left transition-colors" style={{ borderColor: format.rewards.reinforcement === mode ? '#C9A84C' : '#242436', background: format.rewards.reinforcement === mode ? '#C9A84C12' : '#0F0F1A' }}>
                      <div className="flex items-center justify-between gap-2"><div className="text-xs font-bold text-white">{title}</div>{format.rewards.reinforcement === mode && <CheckCircle2 size={14} className="text-[#C9A84C]" />}</div>
                      <div className="mt-1 text-[10px] leading-relaxed text-[var(--ui-text-muted)]">{description}</div>
                    </ChoiceCard>
                  ))}
                </div>
                {hasLeague || isGroups ? (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-panel-inset)] px-3 py-2.5 text-[10px] leading-relaxed text-[var(--ui-text-faint)]">
                    <Info size={14} className="mt-0.5 shrink-0 text-[#C9A84C]" />
                    <span><strong className="text-white">Como funciona:</strong> liga e grupos são organizados por rodadas; o mata-mata, por fases eliminatórias. Na liga/grupos, “disponível até a rodada” define a última rodada que pode gerar recrutamento.</span>
                  </div>
                ) : null}
                {isReinforcementEnabled && (
                  <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-panel-inset)] p-4 sm:grid-cols-2">
                    {format.rewards.reinforcement === 'round' ? (
                    <NumberField
                        label="Recrutamento disponível até a rodada"
                        value={format.rewards.reinforcementUntilRound ?? 1}
                        min={1}
                        max={reinforcementLimit}
                        onChange={value => setRewardNumber('reinforcementUntilRound', value)}
                        helper={`A oferta aparece ao fechar cada rodada até a ${reinforcementLimit}ª, conforme o limite definido.`}
                      />
                    ) : (
                      <label className="block">
                        <span className="flex items-center justify-between gap-2"><span className={labelClass}>Disponível até</span><span className="text-[10px] font-medium normal-case tracking-normal text-[var(--ui-text-faint)]">inclui a fase escolhida</span></span>
                        <select value={selectedStageValue} onChange={event => setRewardNumber('reinforcementUntilRound', event.target.value)} className={inputClass}>
                          {stageOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                        <span className="mt-1 block text-[10px] leading-relaxed text-[var(--ui-text-faint)]">O limite inclui a fase selecionada: a oferta aparece depois que ela termina. A final nunca oferece recrutamento.</span>
                      </label>
                    )}
                    <NumberField label="Opções por recrutamento" value={format.rewards.reinforcementOptions} min={MIN_REINFORCEMENT_OPTIONS} max={MAX_REINFORCEMENT_OPTIONS} onChange={value => setRewardNumber('reinforcementOptions', value)} helper="Quantidade de jogadores exibidos na oferta gratuita." />
                  </div>
                )}
              </div>

              <div className="mt-6 border-t border-[var(--ui-line-subtle)] pt-5">
                <div className="flex items-center gap-2 text-sm font-bold text-white"><Trophy size={16} className="text-[#C9A84C]" /> Créditos da loja</div>
                <p className="mt-1 text-xs text-[var(--ui-text-muted)]">Créditos são a moeda usada na loja. A classificação do torneio continua sendo calculada separadamente pelos resultados.</p>
                <div className="mt-3 flex flex-col gap-2">
                  <ToggleRow title="Créditos por partida" description={format.rewards.pointsEnabled ? 'Vitória, gols e outros critérios adicionam saldo para gastar na loja.' : 'As partidas não adicionam créditos ao saldo da loja.'} enabled={format.rewards.pointsEnabled} onToggle={() => { setFormat(previous => updateRewards(previous, { pointsEnabled: !previous.rewards.pointsEnabled })); setError(null); }} />
                  {hasKnockout && <ToggleRow title="Créditos no mata-mata" description="Defina se as partidas eliminatórias também dão créditos para a loja." enabled={format.rewards.knockoutPointsEnabled} onToggle={() => { setFormat(previous => updateRewards(previous, { knockoutPointsEnabled: !previous.rewards.knockoutPointsEnabled })); setError(null); }} />}
                </div>
                {format.rewards.pointsEnabled && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {([['win', 'Vitória'], ['draw', 'Empate'], ['loss', 'Derrota'], ['goalDifference', 'Saldo positivo'], ['goal', 'Gol marcado'], ['cleanSheet', 'Sem sofrer gol']] as const).map(([key, title]) => (
                      <NumberField key={key} label={title} value={format.rewards.points[key]} min={0} max={MAX_POINTS_PER_RULE} onChange={value => setPoints(key, value)} helper={`0 a ${MAX_POINTS_PER_RULE} créditos.`} />
                    ))}
                  </div>
                )}
              </div>
            </ConfigSection>

            <ConfigSection index={hasKnockout ? '04' : '03'} eyebrow="REGRAS DA PARTIDA" title="Como cada partida acontece?" description="Personalize os eventos disciplinares desta competição." icon={<Settings2 size={17} />}>
              <div className="flex flex-col gap-3">
                <ToggleRow
                  title="Lesões"
                  description="Jogadores podem se lesionar durante a partida e ficar indisponíveis nas próximas rodadas."
                  enabled={format.matchSettings.injuriesEnabled}
                  onToggle={() => setMatchSetting('injuriesEnabled', !format.matchSettings.injuriesEnabled)}
                />
                <ToggleRow
                  title="Cartões"
                  description="Ative para permitir amarelos, vermelhos e suspensões. As faltas continuam existindo mesmo desligado."
                  enabled={format.matchSettings.cardsEnabled}
                  onToggle={() => setMatchSetting('cardsEnabled', !format.matchSettings.cardsEnabled)}
                />
              </div>

            </ConfigSection>
          </motion.div>
          )}

          <aside className={advancedOpen ? 'flex flex-col gap-4 lg:sticky lg:top-24' : ''}>
            <div className="ui-panel overflow-hidden p-0">
              <div className="border-b border-[var(--ui-line-subtle)] px-5 py-4 sm:px-6">
                <div className="ui-section-label">RESUMO DO TORNEIO</div>
                <div className="mt-2 text-lg font-bold leading-snug text-white">{competitionFormatSummary(format)}</div>
                <div className="mt-3 text-xs leading-relaxed text-[var(--ui-text-muted)]">{competitionRewardSummary(format)}</div>
                <div className="mt-3 border-t border-[var(--ui-line-subtle)] pt-3 text-[10px] leading-relaxed text-[var(--ui-text-faint)]">
                  <span className="font-bold text-[var(--ui-text-muted)]">PARTIDA:</span>{' '}
                  {format.matchSettings.injuriesEnabled ? 'lesões' : 'sem lesões'} · {format.matchSettings.cardsEnabled ? 'cartões' : 'sem cartões'} · banca de apostas fixa
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 p-4 sm:p-5">
                <div className="rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-panel-inset)] p-3"><div className="text-2xl font-black text-[#C9A84C]">{format.teamCount}</div><div className="text-[10px] uppercase tracking-wider text-[var(--ui-text-faint)]">times totais</div></div>
                <div className="rounded-xl border border-[var(--ui-line-subtle)] bg-[var(--ui-panel-inset)] p-3"><div className="text-2xl font-black text-[#C9A84C]">{isOnlineRoomCreation ? 'AUTO' : Math.max(0, format.teamCount - 1)}</div><div className="text-[10px] uppercase tracking-wider text-[var(--ui-text-faint)]">{isOnlineRoomCreation ? 'bots completam as vagas' : 'bots no solo'}</div></div>
              </div>
              <div className={`mx-4 mb-4 flex items-start gap-2 rounded-xl border px-3 py-3 text-[11px] leading-relaxed sm:mx-5 sm:mb-5 ${validationError ? 'border-[var(--ui-danger)] bg-[var(--ui-danger)]0D text-[var(--ui-danger)]' : 'border-[var(--ui-success)] bg-[var(--ui-success)]0D text-[var(--ui-success)]'}`} role="status">
                {validationError ? <AlertTriangle size={15} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={15} className="mt-0.5 shrink-0" />}
                <div><strong className="block">{validationError ? 'Revise a configuração' : 'Configuração válida'}</strong><span className="mt-0.5 block">{validationError ?? 'Os limites e as relações entre as fases estão coerentes.'}</span></div>
              </div>
            </div>

            {advancedOpen && (
              <div className="ui-panel ui-panel--inset p-5">
                <div className="ui-section-label">LIMITES AUTOMÁTICOS</div>
                <div className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[var(--ui-text-muted)]"><Bot size={15} className="mt-0.5 shrink-0 text-[#C9A84C]" /><span><strong className="text-white">Solo:</strong> até {MAX_BOT_TEAMS} bots, completando no máximo {MAX_COMPETITION_TEAMS} times.</span></div>
                <div className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[var(--ui-text-muted)]"><Users size={15} className="mt-0.5 shrink-0 text-[#C9A84C]" /><span><strong className="text-white">Online:</strong> os bots completam o total depois dos jogadores humanos; a sala suporta até {MAX_ONLINE_PLAYERS} pessoas.</span></div>
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

function updateRewards(format: CompetitionFormat, patch: Partial<CompetitionFormat['rewards']>): CompetitionFormat {
  return { ...format, rewards: { ...format.rewards, ...patch, points: { ...format.rewards.points } } };
}
