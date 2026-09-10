// UCL Immortals — Crest Selection Page
// Between "difficulty" and "coach": pick a club crest (organized by league). Optional — you can
// skip and keep an initials badge. Only the OPEN league's grid renders (plus search results), and
// images are lazy-loaded, so the ~100-crest catalogue never janks.

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { CREST_CATALOG, ALL_CRESTS, getCrest } from '../lib/crests';
import { AppShell, Button, Input, PageContainer, Panel, SectionHeader, TopBar } from '../design-system';
const GOLD = '#C9A84C';

export default function CrestPage() {
  const { state, dispatch } = useGame();
  const [openLeague, setOpenLeague] = useState(CREST_CATALOG[0]?.league ?? '');
  const [query, setQuery] = useState('');
  const selected = state.selectedCrestId;

  const search = query.trim().toLowerCase();
  const searchResults = useMemo(
    () => search ? ALL_CRESTS.filter(c => c.name.toLowerCase().includes(search)) : [],
    [search]
  );

  const pick = (id: string) => dispatch({ type: 'SET_CREST', crestId: selected === id ? null : id });
  const handleContinue = () => dispatch({ type: 'SET_PHASE', phase: 'coach' });
  const handleBack = () => dispatch({ type: 'SET_PHASE', phase: 'setup' });

  const activeGroup = CREST_CATALOG.find(g => g.league === openLeague);
  const shownCrests = search ? searchResults : (activeGroup?.crests ?? []);
  const selectedDef = getCrest(selected);

  return (
    <AppShell>
      <TopBar />

      <PageContainer wide>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
          <SectionHeader
            kicker="IDENTIDADE DO CLUBE · 02"
            title="Escolha seu escudo"
            description="Represente um clube no torneio. É só visual — não muda os atributos. Opcional: pode pular e usar as iniciais do time."
            className="mb-6"
          />

          {/* Selected preview */}
          <div className="flex items-center justify-center gap-3 mb-5 min-h-[56px]">
            {selectedDef ? (
              <>
                <img src={selectedDef.url} alt={selectedDef.name} referrerPolicy="no-referrer" loading="lazy"
                  className="w-12 h-12 object-contain" />
                <span className="text-lg font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: GOLD }}>
                  {selectedDef.name.toUpperCase()}
                </span>
                <Button onClick={() => dispatch({ type: 'SET_CREST', crestId: null })} intent="ghost" className="min-h-8 px-2 text-xs">
                  remover
                </Button>
              </>
            ) : (
              <span className="text-sm" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                Nenhum escudo selecionado (usará as iniciais do time)
              </span>
            )}
          </div>

          {/* Search */}
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="🔍 Buscar clube..."
            className="ui-input mb-4"
            aria-label="Buscar clube"
          />

          {/* League tabs (hidden while searching) */}
          {!search && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
              {CREST_CATALOG.map(g => {
                const active = g.league === openLeague;
                return (
                  <Button key={g.league} onClick={() => setOpenLeague(g.league)} intent="ghost"
                    className="whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background: active ? `${GOLD}22` : '#0F0F1A',
                      border: `1px solid ${active ? GOLD : '#1A1A2A'}`,
                      color: active ? GOLD : '#8A8A9A',
                      fontFamily: 'Rajdhani, sans-serif',
                    }}>
                    {g.league}
                  </Button>
                );
              })}
            </div>
          )}

          {/* Crest grid — only the open league (or search results) renders */}
          <Panel tone="inset" className="p-3 sm:p-4">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {shownCrests.map((c, i) => {
              const isSel = selected === c.id;
              return (
                <motion.button
                  key={c.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(i * 0.015, 0.3) }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => pick(c.id)}
                  className="ui-choice flex flex-col items-center gap-1.5 p-3"
                  data-selected={isSel}
                  style={{
                    background: isSel ? `${GOLD}14` : undefined,
                    border: `1px solid ${isSel ? GOLD : '#1A1A2A'}`,
                    boxShadow: isSel ? `0 0 0 1px ${GOLD}22` : 'none',
                  }}
                >
                  <img src={c.url} alt={c.name} referrerPolicy="no-referrer" loading="lazy" decoding="async"
                    className="w-12 h-12 object-contain" />
                  <span className="text-[10px] font-semibold text-center leading-tight truncate w-full"
                    style={{ color: isSel ? GOLD : '#C9C9D9', fontFamily: 'Rajdhani, sans-serif' }}>
                    {c.name}
                  </span>
                </motion.button>
              );
            })}
          </div>
          </Panel>
          {search && shownCrests.length === 0 && (
            <div className="text-center py-8 text-sm" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
              Nenhum clube encontrado para “{query}”.
            </div>
          )}

          {/* Continue */}
          <div className="mt-8 flex gap-3">
            {state.mode !== 'online' && (
              <Button onClick={handleBack} intent="ghost" className="border border-[var(--ui-line-subtle)]">
                ← VOLTAR
              </Button>
            )}
            <Button
              intent="primary"
              size="large"
              onClick={handleContinue}
              className={state.mode === 'online' ? 'w-full' : 'flex-1'}
            >
              {selected ? 'ESCOLHER TREINADOR →' : 'PULAR / ESCOLHER TREINADOR →'}
            </Button>
          </div>
        </motion.div>
      </PageContainer>
    </AppShell>
  );
}
