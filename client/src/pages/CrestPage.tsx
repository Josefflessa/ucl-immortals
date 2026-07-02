// UCL Immortals — Crest Selection Page
// Between "difficulty" and "coach": pick a club crest (organized by league). Optional — you can
// skip and keep an initials badge. Only the OPEN league's grid renders (plus search results), and
// images are lazy-loaded, so the ~100-crest catalogue never janks.

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../contexts/GameContext';
import { CREST_CATALOG, ALL_CRESTS, getCrest } from '../lib/crests';

const LOGO_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663774909050/NneEChWpuMBUGrgKbtsKZM/ucl-logo-LCN5rzJFFXKm2BbirdmWEt.webp';
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

  const activeGroup = CREST_CATALOG.find(g => g.league === openLeague);
  const shownCrests = search ? searchResults : (activeGroup?.crests ?? []);
  const selectedDef = getCrest(selected);

  const steps = ['Dificuldade', 'Escudo', 'Treinador', 'Formação', 'Draft'];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#080810' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: '#1A1A2A' }}>
        <img src={LOGO_URL} alt="UCL Immortals" className="w-8 h-8 object-contain" />
        <span className="text-lg font-black tracking-widest" style={{ fontFamily: 'Bebas Neue, sans-serif', color: GOLD }}>
          UCL IMMORTALS
        </span>
        <div className="ml-auto flex items-center gap-2">
          {steps.map((step, i) => (
            <div key={step} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: i === 1 ? GOLD : i < 1 ? '#22C55E' : '#333' }} />
              <span className="text-xs hidden sm:block" style={{ color: i === 1 ? GOLD : i < 1 ? '#22C55E' : '#555', fontFamily: 'Rajdhani, sans-serif' }}>{step}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-4xl">
          <div className="text-center mb-6">
            <h2 className="text-4xl font-black tracking-widest mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFFFFF' }}>
              ESCOLHA SEU ESCUDO
            </h2>
            <p style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
              Represente um clube no torneio. É só visual — não muda os atributos. Opcional: pode pular e usar as iniciais do time.
            </p>
          </div>

          {/* Selected preview */}
          <div className="flex items-center justify-center gap-3 mb-5 min-h-[56px]">
            {selectedDef ? (
              <>
                <img src={selectedDef.url} alt={selectedDef.name} referrerPolicy="no-referrer" loading="lazy"
                  className="w-12 h-12 object-contain" />
                <span className="text-lg font-black" style={{ fontFamily: 'Bebas Neue, sans-serif', color: GOLD }}>
                  {selectedDef.name.toUpperCase()}
                </span>
                <button onClick={() => dispatch({ type: 'SET_CREST', crestId: null })}
                  className="text-xs px-2 py-1 rounded" style={{ background: '#1A1A2A', color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
                  remover
                </button>
              </>
            ) : (
              <span className="text-sm" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
                Nenhum escudo selecionado (usará as iniciais do time)
              </span>
            )}
          </div>

          {/* Search */}
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="🔍 Buscar clube..."
            className="w-full mb-4 px-4 py-2.5 rounded-lg text-sm outline-none"
            style={{ background: '#0F0F1A', border: '1px solid #1A1A2A', color: '#fff', fontFamily: 'Rajdhani, sans-serif' }}
          />

          {/* League tabs (hidden while searching) */}
          {!search && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
              {CREST_CATALOG.map(g => {
                const active = g.league === openLeague;
                return (
                  <button key={g.league} onClick={() => setOpenLeague(g.league)}
                    className="whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background: active ? `${GOLD}22` : '#0F0F1A',
                      border: `1px solid ${active ? GOLD : '#1A1A2A'}`,
                      color: active ? GOLD : '#8A8A9A',
                      fontFamily: 'Rajdhani, sans-serif',
                    }}>
                    {g.league}
                  </button>
                );
              })}
            </div>
          )}

          {/* Crest grid — only the open league (or search results) renders */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
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
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all"
                  style={{
                    background: isSel ? `linear-gradient(135deg, ${GOLD}22 0%, #0F0F1A 100%)` : '#0F0F1A',
                    border: `1px solid ${isSel ? GOLD : '#1A1A2A'}`,
                    boxShadow: isSel ? `0 0 20px ${GOLD}33` : 'none',
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
          {search && shownCrests.length === 0 && (
            <div className="text-center py-8 text-sm" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>
              Nenhum clube encontrado para “{query}”.
            </div>
          )}

          {/* Continue */}
          <motion.button
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={handleContinue}
            className="w-full mt-8 py-4 rounded-xl font-black text-xl tracking-widest"
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              background: 'linear-gradient(135deg, #C9A84C 0%, #E8C84A 50%, #C9A84C 100%)',
              color: '#080810',
              boxShadow: '0 0 30px rgba(201,168,76,0.3)',
            }}
          >
            {selected ? 'ESCOLHER TREINADOR →' : 'PULAR / ESCOLHER TREINADOR →'}
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
