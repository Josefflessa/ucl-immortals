// UCL Immortals — Crest Selection Page
// Between "difficulty" and "coach": pick a club crest (organized by league). Optional — you can
// skip and keep an initials badge. Only the OPEN league's grid renders (plus search results), and
// images are lazy-loaded, so the ~100-crest catalogue never janks.

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import { useAccount } from '../contexts/AccountContext';
import CompetitionExitControl from '../components/game/CompetitionExitControl';
import { NATIONAL_TEAM_CRESTS, PLAYABLE_CREST_CATALOG, PLAYABLE_CRESTS, getCrest } from '@shared/game/crests';
import { AppShell, Button, FixedActionBar, Input, PageContainer, Panel, SectionHeader, TopBar } from '../design-system';
const GOLD = '#C9A84C';
const NATIONAL_TEAMS_TAB = 'Seleções';

export default function CrestPage() {
  const { state, dispatch } = useGame();
  const { account, getEvents } = useAccount();
  const [openLeague, setOpenLeague] = useState(PLAYABLE_CREST_CATALOG[0]?.league ?? '');
  const [query, setQuery] = useState('');
  const [unlockedCrests, setUnlockedCrests] = useState<string[]>([]);
  const selected = state.selectedCrestId;

  useEffect(() => {
    if (!account) {
      setUnlockedCrests([]);
      return;
    }
    let active = true;
    void getEvents()
      .then(payload => { if (active) setUnlockedCrests(payload.crests ?? []); })
      .catch(() => { if (active) setUnlockedCrests([]); });
    return () => { active = false; };
  }, [account?.id, getEvents]);

  const search = query.trim().toLowerCase();
  const searchResults = useMemo(
    () => search ? [...PLAYABLE_CRESTS, ...NATIONAL_TEAM_CRESTS].filter(c => c.name.toLowerCase().includes(search)) : [],
    [search]
  );

  const pick = (id: string) => {
    const crest = getCrest(id);
    if (crest?.teamType === 'national-team' && !unlockedCrests.includes(id)) return;
    dispatch({ type: 'SET_CREST', crestId: selected === id ? null : id });
  };
  // The club's name is asked here, with its crest (the lobby only ever showed the player's own name).
  const teamName = state.teamName ?? '';
  const nameValid = teamName.trim().length >= 2;
  const handleContinue = () => { if (nameValid) dispatch({ type: 'SET_PHASE', phase: 'coach' }); };
  const handleBack = () => dispatch({ type: 'SET_PHASE', phase: 'setup' });

  const activeGroup = PLAYABLE_CREST_CATALOG.find(g => g.league === openLeague);
  const nationalTeamsOpen = openLeague === NATIONAL_TEAMS_TAB;
  const shownCrests = search ? searchResults : nationalTeamsOpen ? NATIONAL_TEAM_CRESTS : (activeGroup?.crests ?? []);
  const selectedDef = getCrest(selected);

  return (
    <AppShell>
      <TopBar right={<CompetitionExitControl />} />

      <PageContainer wide className="pb-32">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
          <SectionHeader
            title="Nome e escudo do time"
            description="Dê um nome ao seu time e represente um clube no torneio. O escudo é só visual — não muda os atributos — e é opcional: pode pular e usar as iniciais."
            className="mb-6"
          />

          {/* The club's name */}
          <Panel tone="inset" className="mx-auto mb-6 max-w-md space-y-2 p-4">
            <label htmlFor="team-name" className="block text-xs font-bold tracking-widest text-primary" style={{ fontFamily: 'var(--font-game), sans-serif' }}>NOME DO SEU TIME</label>
            <Input
              id="team-name"
              type="text"
              value={teamName}
              onChange={event => dispatch({ type: 'SET_TEAM_NAME', name: event.target.value })}
              onKeyDown={event => { if (event.key === 'Enter') handleContinue(); }}
              placeholder="Ex: Real Madrid Lendário"
              maxLength={20}
              autoFocus
              autoComplete="off"
              className="ui-input"
            />
            <p className="text-[12px] text-[var(--ui-text-faint)]" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
              {nameValid ? 'É assim que seu time aparece na competição e no histórico.' : 'Escolha um nome com pelo menos 2 letras para continuar.'}
            </p>
          </Panel>

          {/* Selected preview */}
          <div className="flex items-center justify-center gap-3 mb-5 min-h-[56px]">
            {selectedDef ? (
              <>
                <img src={selectedDef.url} alt={selectedDef.name} referrerPolicy="no-referrer" loading="lazy"
                  className="w-12 h-12 object-contain"
                  style={{ borderRadius: selectedDef.clipToCircle ? '50%' : undefined }} />
                <span className="text-lg font-black" style={{ fontFamily: 'var(--font-display), sans-serif', color: GOLD }}>
                  {selectedDef.name.toUpperCase()}
                </span>
                <Button onClick={() => dispatch({ type: 'SET_CREST', crestId: null })} intent="ghost" className="min-h-8 px-2 text-xs">
                  remover
                </Button>
              </>
            ) : (
              <span className="text-sm" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
                Nenhum escudo selecionado (usará as iniciais do time)
              </span>
            )}
          </div>

          {/* Search */}
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar clube ou seleção..."
            className="ui-input mb-4"
            aria-label="Buscar clube"
          />

          {/* League tabs (hidden while searching) */}
          {!search && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
              <Button onClick={() => setOpenLeague(NATIONAL_TEAMS_TAB)} intent="ghost"
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-all"
                style={{
                  background: nationalTeamsOpen ? `${GOLD}22` : '#0F0F1A',
                  border: `1px solid ${nationalTeamsOpen ? GOLD : '#1A1A2A'}`,
                  color: nationalTeamsOpen ? GOLD : '#8A8A9A',
                  fontFamily: 'var(--font-game), sans-serif',
                }}>
                {NATIONAL_TEAMS_TAB}
              </Button>
              {PLAYABLE_CREST_CATALOG.map(g => {
                const active = g.league === openLeague;
                return (
                  <Button key={g.league} onClick={() => setOpenLeague(g.league)} intent="ghost"
                    className="whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background: active ? `${GOLD}22` : '#0F0F1A',
                      border: `1px solid ${active ? GOLD : '#1A1A2A'}`,
                      color: active ? GOLD : '#8A8A9A',
                      fontFamily: 'var(--font-game), sans-serif',
                    }}>
                    {g.league}
                  </Button>
                );
              })}
            </div>
          )}

          {/* Crest grid — only the open league (or search results) renders */}
          <Panel tone="inset" className="p-3 sm:p-4">
          {!search && nationalTeamsOpen && !unlockedCrests.includes('brazil') ? (
            <p className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-1)] px-3 py-2 text-xs leading-relaxed text-[var(--ui-text-muted)]">
              <Lock size={14} className="shrink-0" aria-hidden="true" />
              O escudo do Brasil é desbloqueado no evento Brasil em Campo.
            </p>
          ) : null}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {shownCrests.map((c, i) => {
              const isSel = selected === c.id;
              const isUnlocked = c.teamType !== 'national-team' || unlockedCrests.includes(c.id);
              return (
                <motion.button
                  key={c.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(i * 0.015, 0.3) }}
                  whileHover={isUnlocked ? { scale: 1.05, y: -2 } : undefined}
                  whileTap={isUnlocked ? { scale: 0.96 } : undefined}
                  onClick={() => pick(c.id)}
                  onDoubleClick={() => {
                    // A browser fires the second click before dblclick. Because a
                    // single click on an already-selected crest clears it, write
                    // the chosen crest again here before moving to the coach step.
                    dispatch({ type: 'SET_CREST', crestId: c.id });
                    handleContinue();
                  }}
                  disabled={!isUnlocked}
                  title={isUnlocked ? 'Clique duas vezes para escolher e continuar' : 'Conclua o evento Brasil em Campo para desbloquear'}
                  className={`ui-choice relative flex flex-col items-center gap-1.5 p-3 ${isUnlocked ? '' : 'cursor-not-allowed opacity-55'}`}
                  data-selected={isSel}
                  style={{
                    background: isSel ? `${GOLD}14` : undefined,
                    border: `1px solid ${isSel ? GOLD : '#1A1A2A'}`,
                    boxShadow: isSel ? `0 0 0 1px ${GOLD}22` : 'none',
                  }}
                >
                  <img src={c.url} alt={c.name} referrerPolicy="no-referrer" loading="lazy" decoding="async"
                    className={`h-12 w-12 object-contain ${isUnlocked ? '' : 'grayscale'}`}
                    style={{ borderRadius: c.clipToCircle ? '50%' : undefined }} />
                  {!isUnlocked ? <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full border border-white/10 bg-black/75 text-white/80"><Lock size={11} aria-hidden="true" /></span> : null}
                  <span className="text-[12px] font-semibold text-center leading-tight truncate w-full"
                    style={{ color: isSel ? GOLD : '#C9C9D9', fontFamily: 'var(--font-game), sans-serif' }}>
                    {c.name}
                  </span>
                  {!isUnlocked ? <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--ui-text-faint)]">Evento</span> : null}
                </motion.button>
              );
            })}
          </div>
          </Panel>
          {search && shownCrests.length === 0 && (
            <div className="text-center py-8 text-sm" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>
              Nenhum clube encontrado para “{query}”.
            </div>
          )}

        </motion.div>
      </PageContainer>
      <FixedActionBar>
        {state.mode !== 'online' && (
          <Button onClick={handleBack} intent="ghost" className="border border-[var(--ui-line-subtle)]">
            ← VOLTAR
          </Button>
        )}
        <Button
          intent="primary"
          size="large"
          onClick={handleContinue}
          disabled={!nameValid}
          className={state.mode === 'online' ? 'w-full' : 'flex-1'}
        >
          {selected ? 'ESCOLHER TREINADOR →' : 'PULAR / ESCOLHER TREINADOR →'}
        </Button>
      </FixedActionBar>
    </AppShell>
  );
}
