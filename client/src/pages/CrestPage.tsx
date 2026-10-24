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
import Crest from '../components/game/Crest';
import { AppShell, Button, Chip, EmptyState, Field, FixedActionBar, Input, PageContainer, Panel, SectionHeader, TopBar } from '../design-system';
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
            description="Dê um nome ao seu time e, se quiser, escolha um escudo. O escudo é só visual: não muda nenhum atributo."
            className="mb-6"
          />

          {/* PC: the team card stays on the left while the crest list scrolls on the right.
              Phone: the card comes first, then the list. */}
          <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-8">
          <aside className="mb-8 lg:sticky lg:top-6 lg:mb-0">
            <Panel className="p-4 sm:p-5">
              <div className="flex items-center gap-4 lg:flex-col lg:gap-3 lg:text-center">
                <div className="grid size-20 shrink-0 place-items-center rounded-(--ui-radius-lg) border border-[var(--ui-line-subtle)] bg-[var(--ui-surface-inset)] lg:size-32">
                  <span className="lg:hidden"><Crest crestId={selected} name={teamName.trim() || undefined} size={56} /></span>
                  <span className="hidden lg:block"><Crest crestId={selected} name={teamName.trim() || undefined} size={96} /></span>
                </div>
                <div className="min-w-0 flex-1 lg:w-full">
                  <div className="truncate font-display text-title-lg uppercase leading-none tracking-caps text-[var(--ui-text)]">{teamName.trim() || 'Seu time'}</div>
                  <div className="mt-1.5 flex min-w-0 items-center gap-2 text-label text-[var(--ui-text-muted)] lg:justify-center">
                    <span className="truncate">{selectedDef ? selectedDef.name : 'Sem escudo: usa as iniciais'}</span>
                    {selectedDef ? (
                      <button type="button" onClick={() => dispatch({ type: 'SET_CREST', crestId: null })} className="shrink-0 font-semibold text-[var(--ui-brand-strong)] underline-offset-2 hover:underline">
                        Remover
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
              <Field
                label="Nome do seu time"
                htmlFor="team-name"
                hint={nameValid ? 'Aparece na competição e no histórico.' : 'Use pelo menos 2 letras para continuar.'}
                className="mt-4 border-t border-[var(--ui-line-subtle)] pt-4"
              >
                <Input
                  id="team-name"
                  type="text"
                  value={teamName}
                  onChange={event => dispatch({ type: 'SET_TEAM_NAME', name: event.target.value })}
                  onKeyDown={event => { if (event.key === 'Enter') handleContinue(); }}
                  placeholder="Ex.: Real Madrid Lendário"
                  maxLength={20}
                  autoFocus
                  autoComplete="off"
                />
              </Field>
            </Panel>
          </aside>

          <section className="min-w-0" aria-label="Escudo">
          <SectionHeader
            level="section"
            title="Escudo"
            description="Opcional. Sem escudo, o time usa as iniciais do nome."
          />

          {/* Search */}
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar clube ou seleção"
            className="mb-3"
            aria-label="Buscar clube ou seleção"
            type="search"
          />

          {/* League filter (hidden while searching) */}
          {!search && (
            <div className="ui-chip-row mb-4" role="group" aria-label="Filtrar por liga">
              <Chip selected={nationalTeamsOpen} onClick={() => setOpenLeague(NATIONAL_TEAMS_TAB)}>
                {NATIONAL_TEAMS_TAB}
              </Chip>
              {PLAYABLE_CREST_CATALOG.map(g => (
                <Chip key={g.league} selected={g.league === openLeague} onClick={() => setOpenLeague(g.league)}>
                  {g.league}
                </Chip>
              ))}
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
          <div className="grid grid-cols-3 gap-2 min-[380px]:grid-cols-4 sm:gap-3 md:grid-cols-5 xl:grid-cols-6">
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
                  className={`ui-choice relative flex flex-col items-center gap-1.5 px-1.5 py-2.5 sm:p-3 ${isUnlocked ? '' : 'cursor-not-allowed opacity-55'}`}
                  data-selected={isSel}
                  style={{
                    background: isSel ? `${GOLD}14` : undefined,
                    border: `1px solid ${isSel ? GOLD : '#1A1A2A'}`,
                    boxShadow: isSel ? `0 0 0 1px ${GOLD}22` : 'none',
                  }}
                >
                  <img src={c.url} alt={c.name} referrerPolicy="no-referrer" decoding="async"
                    className={`h-10 w-10 object-contain sm:h-12 sm:w-12 ${isUnlocked ? '' : 'grayscale'}`}
                    style={{ borderRadius: c.clipToCircle ? '50%' : undefined }} />
                  {!isUnlocked ? <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full border border-white/10 bg-black/75 text-white/80"><Lock size={11} aria-hidden="true" /></span> : null}
                  <span className="w-full truncate text-center text-micro font-semibold leading-ui-tight sm:text-label"
                    style={{ color: isSel ? GOLD : 'var(--ui-text-soft)' }}>
                    {c.name}
                  </span>
                  {!isUnlocked ? <span className="text-micro font-semibold uppercase tracking-caps text-[var(--ui-text-muted)]">Evento</span> : null}
                </motion.button>
              );
            })}
          </div>
          </Panel>
          {search && shownCrests.length === 0 && (
            <EmptyState className="mt-3" title="Nenhum clube encontrado" description={`Não achamos “${query}”. Confira a grafia ou procure pelo nome curto do clube.`} />
          )}
          </section>
          </div>

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
          ESCOLHER TREINADOR
        </Button>
      </FixedActionBar>
    </AppShell>
  );
}
