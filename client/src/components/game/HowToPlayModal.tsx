// UCL Immortals — "Como Jogar" — a complete, didactic in-game guide.
// Tabbed, mobile-friendly overlay that teaches the WHOLE game end to end: flow, draft, chemistry,
// formations, tactics, rarities, traits, special cards, captain/takers, shop and knockout.
// Pulls live data (tactics, shop costs, variants) so it never drifts from the engine.
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TACTICS, getRarityColor, Rarity } from '../../lib/gameData';
import { SHOP_COSTS, trainCost, TRAIN_BOOST, TURBINAR_VARIANTS } from '../../lib/shop';

const GOLD = '#C9A84C';

// ── small presentational helpers ──────────────────────────────────────────────
function Card({ children, accent = '#1A1A2A' }: { children: React.ReactNode; accent?: string }) {
  return <div className="ui-panel p-4" style={{ borderColor: accent }}>{children}</div>;
}
function H({ children }: { children: React.ReactNode }) {
  return <div className="ui-panel__title mb-1 text-[var(--ui-text)]">{children}</div>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-[var(--ui-text-soft)]">{children}</p>;
}
function Chip({ children, color = GOLD }: { children: React.ReactNode; color?: string }) {
  return <span className="text-[11px] font-black px-2 py-0.5 rounded" style={{ background: `${color}22`, color, border: `1px solid ${color}44`, fontFamily: 'Rajdhani, sans-serif' }}>{children}</span>;
}
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-black" style={{ background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}55`, fontFamily: 'Bebas Neue, sans-serif' }}>{n}</div>
      <div className="min-w-0 flex-1 pb-1">
        <div className="text-[13px] font-black" style={{ color: '#FFF', fontFamily: 'Rajdhani, sans-serif' }}>{title}</div>
        <div className="text-[12px] leading-relaxed mt-0.5" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>{children}</div>
      </div>
    </div>
  );
}

const FORMATION_GUIDE = [
  { id: '4-3-3', identity: 'Equilíbrio com pegada ofensiva', desc: 'Três atacantes dão largura e presença na área; o trio de meio sustenta. Versátil, boa por padrão.' },
  { id: '4-2-3-1', identity: 'Controle e solidez', desc: 'Dois volantes blindam a defesa e um meia criativo arma o jogo. Mais equilibrada/defensiva.' },
  { id: '4-4-2', identity: 'O clássico equilibrado', desc: 'Duas linhas de quatro bem organizadas e dupla de ataque. Sem pontos fracos, sem exageros.' },
  { id: '3-5-2', identity: 'Domínio de meio-campo', desc: 'Cinco no meio controlam o jogo — mas as pontas ficam expostas (sem alas de origem).' },
  { id: '3-4-3', identity: 'Ultraofensiva', desc: 'Muita gente no ataque e pressão alta: cria MUITO, porém a defesa de três sofre mais.' },
  { id: '5-3-2', identity: 'Muralha', desc: 'Cinco defensores em bloco baixo: sofre pouquíssimo, mas cria pouco. Para segurar resultado.' },
];

const RARITIES: { r: Rarity; label: string; desc: string }[] = [
  { r: 'bronze', label: 'Bronze', desc: 'Jogadores comuns — a base do elenco.' },
  { r: 'silver', label: 'Prata', desc: 'Bons jogadores, peças confiáveis.' },
  { r: 'gold', label: 'Ouro', desc: 'Craques consagrados.' },
  { r: 'legendary', label: 'Lendário', desc: 'Jogadores históricos — diferença real.' },
  { r: 'immortal', label: 'Imortal', desc: 'Ícones raros para elevar o elenco.' },
];

export default function HowToPlayModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState(0);

  const SECTIONS: { icon: string; label: string; body: React.ReactNode }[] = [
    {
      icon: '🎮', label: 'Visão Geral',
      body: (
        <div className="space-y-4">
          <Card accent={`${GOLD}44`}>
            <H>O OBJETIVO</H>
            <P>Monte um elenco histórico e competitivo, combinando jogadores de diferentes épocas, perfis e raridades. Leve seu time ao título da <b style={{ color: GOLD }}>Ultimate Champions League</b> em uma fase de liga e depois um mata-mata até a grande final.</P>
          </Card>
          <Card>
            <H>O PASSO A PASSO</H>
            <div className="space-y-3 mt-2">
              <Step n={1} title="Escolha o Técnico">Cada técnico dá buffs e uma habilidade especial diferentes (e tem uma formação preferida que rende +química).</Step>
              <Step n={2} title="Escolha a Formação inicial">Define as posições que você vai preencher no draft.</Step>
              <Step n={3} title="Draft">Monte seu XI (11 titulares) + 2 reservas pro banco, escolhendo cartas rodada a rodada. Você tem 4 vetos.</Step>
              <Step n={4} title="Revisão do elenco">Ajuste formação, tática, capitão e cobradores; veja a química.</Step>
              <Step n={5} title="Liga configurável">Jogue contra os outros times. A duração e a linha de classificação são definidas antes do draft; ganhe pontos e um reforço grátis a cada rodada.</Step>
              <Step n={6} title="Mata-mata">Os melhores avançam para playoffs (quando houver) → oitavas → quartas → semis → final.</Step>
            </div>
          </Card>
          <Card>
            <H>ENTRE AS PARTIDAS</H>
            <P>No hub você pode: trocar formação/tática, mexer no time (banco ↔ titular), definir capitão e cobradores, e gastar pontos na <b style={{ color: GOLD }}>🛒 Loja</b>. Tudo isso afeta a próxima partida.</P>
          </Card>
        </div>
      ),
    },
    {
      icon: '🃏', label: 'Draft',
      body: (
        <div className="space-y-4">
          <Card><H>Como funciona</H><P>A cada vez é oferecido um conjunto de cartas. Você escolhe uma para ocupar uma posição da sua formação. O jogo garante que sempre apareça alguém que serve para a próxima posição que falta.</P></Card>
          <Card><H>Veto</H><P>Não gostou das opções? Use um <b style={{ color: GOLD }}>veto</b> para sortear cartas novas. Os vetos são limitados, então use com sabedoria.</P></Card>
          <Card accent="#22C55E44"><H>Dica</H><P>Pense na <b style={{ color: '#22C55E' }}>química</b> desde o draft: jogadores do mesmo clube, nação ou que jogaram com o seu técnico se conectam melhor. Um time afiado vale mais que 11 craques soltos.</P></Card>
        </div>
      ),
    },
    {
      icon: '⚗️', label: 'Química',
      body: (
        <div className="space-y-4">
          <Card accent="#3B82F644"><H>O que é</H><P>Química mede o quanto seus titulares "se entendem". Quanto maior, mais os atributos efetivos sobem na partida. Some uma das maiores forças do jogo.</P></Card>
          <Card>
            <H>Vínculos entre dois jogadores</H>
            <P>Cada par de titulares forma <b style={{ color: '#FFF' }}>no máximo um</b> vínculo, nesta prioridade:</P>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Chip color="#22C55E">Mesmo clube +2</Chip>
              <Chip color="#4FC3F7">Mesma nação +1</Chip>
              <Chip color="#E8C84A">Mesmo técnico +2</Chip>
              <Chip color="#A855F7">Dupla histórica +1</Chip>
            </div>
            <P><span className="block mt-2">+1 extra para cada jogador que já foi treinado pelo técnico atual do time.</span></P>
          </Card>
          <Card>
            <H>Individual (0–3) e Total (0–100)</H>
            <P>Cada jogador tem uma química individual de <b style={{ color: '#FFF' }}>0 a 3</b> (multiplicador de até +10% nos atributos). A soma vira a química <b style={{ color: '#FFF' }}>total do time (0–100)</b>, que dá um bônus em TODOS os atributos de todos os titulares, subindo a cada marco:</P>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip color="#22C55E">45+ → +1</Chip>
              <Chip color="#22C55E">60+ → +2</Chip>
              <Chip color="#22C55E">75+ → +3</Chip>
              <Chip color="#22C55E">90+ → +5 (perfeita)</Chip>
            </div>
          </Card>
          <Card accent="#EF444444">
            <H>⚠️ Fora de posição</H>
            <P>Escalar alguém fora da posição natural <b style={{ color: '#EF4444' }}>zera a química dele e reduz os atributos</b>. Evite — a não ser que o jogador tenha a trait <b>Versatilidade</b> (ou seja um Coringa).</P>
          </Card>
          <Card><H>Bônus extras</H><P>Reproduzir <b style={{ color: GOLD }}>trios históricos</b> e usar a <b style={{ color: GOLD }}>formação preferida do técnico</b> dão pontos a mais de química do time.</P></Card>
        </div>
      ),
    },
    {
      icon: '📐', label: 'Formações',
      body: (
        <div className="space-y-3">
          <P>A formação muda como o time cria e sofre chances. Cada uma tem uma identidade — nenhuma é "a melhor", depende do seu plano.</P>
          {FORMATION_GUIDE.map(f => (
            <Card key={f.id}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base font-black px-2 py-0.5 rounded" style={{ background: `${GOLD}22`, color: GOLD, fontFamily: 'Bebas Neue, sans-serif' }}>{f.id}</span>
                <span className="text-[13px] font-black" style={{ color: '#FFF', fontFamily: 'Rajdhani, sans-serif' }}>{f.identity}</span>
              </div>
              <P>{f.desc}</P>
            </Card>
          ))}
          <Card accent="#22C55E44"><P>💡 No mata-mata, escolher uma formação que <b style={{ color: '#22C55E' }}>counter-a</b> a do adversário dá uma pequena vantagem.</P></Card>
        </div>
      ),
    },
    {
      icon: '📋', label: 'Táticas',
      body: (
        <div className="space-y-3">
          <P>A tática (estilo de jogo) ajusta atributos e o jeito do time jogar. Pode ser trocada entre as partidas.</P>
          {TACTICS.map(t => (
            <Card key={t.id}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{t.icon}</span>
                <span className="text-[14px] font-black" style={{ color: '#FFF', fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.06em' }}>{t.name.toUpperCase()}</span>
              </div>
              <P>{t.desc}</P>
            </Card>
          ))}
        </div>
      ),
    },
    {
      icon: '⭐', label: 'Raridades',
      body: (
        <div className="space-y-3">
          <P>A raridade indica o nível histórico da carta — e dá aquele brilho no card.</P>
          {RARITIES.map(({ r, label, desc }) => (
            <div key={r} className="flex items-center gap-3 rounded-xl p-3" style={{ background: '#0F0F1A', border: `1px solid ${getRarityColor(r)}55` }}>
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: getRarityColor(r), boxShadow: `0 0 10px ${getRarityColor(r)}` }} />
              <span className="text-[14px] font-black flex-shrink-0 w-20" style={{ color: getRarityColor(r), fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.06em' }}>{label.toUpperCase()}</span>
              <span className="text-[12px]" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>{desc}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: '✨', label: 'Traits & Cartas',
      body: (
        <div className="space-y-4">
          <Card accent="#A78BFA44">
            <H>✨ Traits (características)</H>
            <P>São habilidades dos jogadores que dão bônus de atributo — algumas sempre ativas, outras em momentos específicos (ex.: na final, no mata-mata, defendendo). Aparecem no card e no modal do jogador, na seção "de onde vem o bônus".</P>
          </Card>
          <H>🃏 Cartas especiais</H>
          <P>Versões raras que aparecem no draft (e podem ser compradas na loja em "Turbinar Carta"):</P>
          {TURBINAR_VARIANTS.map(v => {
            const color = v.color === '#FFFFFF' ? '#E5E7EB' : v.color;
            return (
              <div key={v.key} className="flex gap-3 rounded-xl p-3" style={{ background: '#0F0F1A', border: `1px solid ${color}44` }}>
                <span className="text-2xl flex-shrink-0">{v.icon}</span>
                <div>
                  <div className="text-[13px] font-black" style={{ color, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.04em' }}>{v.label.toUpperCase()}</div>
                  <div className="text-[12px] leading-snug mt-0.5" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>{v.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      ),
    },
    {
      icon: '👑', label: 'Capitão',
      body: (
        <div className="space-y-4">
          <Card accent="#3B82F644">
            <H>👑 Capitão</H>
            <P>O capitão contagia o time: o <b style={{ color: '#93C5FD' }}>melhor atributo dele vira +3 para TODO o time</b> (e para ele mesmo). Escolha um líder com um atributo de destaque que ajude seu plano.</P>
          </Card>
          <Card>
            <H>🎯 Cobrador de Pênalti & Falta</H>
            <P>Você designa quem bate. O cobrador <b style={{ color: '#FFF' }}>oficial converte mais</b> (ganha um bônus de compostura) do que um jogador qualquer batendo. Escolha jogadores frios e com boa finalização.</P>
          </Card>
        </div>
      ),
    },
    {
      icon: '🛒', label: 'Loja & Pontos',
      body: (
        <div className="space-y-4">
          <Card accent="#34D39944">
            <H>💰 Como ganhar pontos</H>
            <P>A cada partida da liga você ganha pontos pelo desempenho: <b>vitória/empate/derrota</b>, <b>saldo de gols</b>, <b>gols marcados</b> e <b>não sofrer gol</b>. Até quem perde leva um pouco.</P>
          </Card>
          <H>O que dá pra comprar</H>
          {[
            { icon: '🎓', name: 'Trocar Técnico', cost: `${SHOP_COSTS.changeCoach}`, d: 'Troca o comandante (muda buffs e estilo).' },
            { icon: '✨', name: 'Turbinar Carta', cost: `${SHOP_COSTS.turbinar}`, d: 'Aplica uma carta especial (Em Alta, Lobo, Coringa…) a um jogador SEM característica.' },
            { icon: '🧹', name: 'Remover Característica', cost: `${SHOP_COSTS.removeVariant}`, d: 'Tira a carta especial de um jogador — pra depois aplicar outra via Turbinar.' },
            { icon: '🌟', name: 'Pacote do Craque', cost: `${SHOP_COSTS.starPack}`, d: 'Escolhe 1 de 3 jogadores de overall 88+.' },
            { icon: '🔍', name: 'Caça-Talentos', cost: `${SHOP_COSTS.scout}`, d: 'Escolhe 1 de 4 jogadores da posição que precisar.' },
            { icon: '💪', name: 'Treino Intensivo', cost: `${trainCost(0)}+`, d: `+${TRAIN_BOOST} permanente num atributo (sem teto). Custa mais a cada treino no mesmo jogador.` },
            { icon: '🔄', name: 'Reroll de Reforço', cost: `${SHOP_COSTS.reroll}`, d: 'Ganha um token pra re-sortear as opções do reforço pós-partida. Acumula entre rodadas.' },
          ].map(i => (
            <div key={i.name} className="flex items-center gap-3 rounded-xl p-3" style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}>
              <span className="text-xl flex-shrink-0">{i.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-black" style={{ color: '#FFF', fontFamily: 'Rajdhani, sans-serif' }}>{i.name}</div>
                <div className="text-[11px] leading-snug" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>{i.d}</div>
              </div>
              <span className="text-[12px] font-black flex-shrink-0 px-2 py-0.5 rounded" style={{ background: '#E8C84A22', color: '#E8C84A', fontFamily: 'Bebas Neue, sans-serif' }}>💰 {i.cost}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: '🏆', label: 'Mata-Mata',
      body: (
        <div className="space-y-4">
          <Card accent={`${GOLD}44`}><H>A reta final</H><P>Após a fase de liga configurada, os melhores avançam para o mata-mata: <b style={{ color: '#FFF' }}>playoffs (quando houver) → oitavas → quartas → semis → final</b>.</P></Card>
          <Card><H>Ida e volta</H><P>Cada confronto (menos a final) é decidido no <b style={{ color: '#FFF' }}>placar agregado</b> dos dois jogos. A final é jogo único, em campo neutro.</P></Card>
          <Card><H>🏟️ Vantagem de casa</H><P>O mandante leva uma pequena vantagem em cada jogo — exceto na final (campo neutro), que é equilibrada.</P></Card>
          <Card><H>🎯 Empate no agregado</H><P>Vai para prorrogação e, persistindo, <b style={{ color: '#FFF' }}>disputa de pênaltis</b> — onde compostura e o goleiro decidem tudo.</P></Card>
        </div>
      ),
    },
    {
      icon: '💡', label: 'Dicas',
      body: (
        <div className="space-y-3">
          {[
            'Química quase sempre vale mais que overall solto: 11 craques sem entrosamento rendem menos que um time afiado.',
            'Combine técnico + formação preferida dele para um empurrão de química de graça.',
            'Como azarão, jogue de Contra-ataque ou Defensivo; como favorito, vá pra cima.',
            'Designe um cobrador frio de pênalti/falta — faz diferença nos detalhes e nos pênaltis.',
            'Use a loja com plano: às vezes trocar o técnico ou turbinar uma carta muda sua campanha.',
            'No mata-mata, segure o jogo fora de casa e ataque em casa (vantagem de mando).',
          ].map((t, i) => (
            <div key={i} className="flex gap-2.5 rounded-xl p-3" style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}>
              <span className="text-base flex-shrink-0">💡</span>
              <span className="text-[12.5px] leading-relaxed" style={{ color: '#C9C9D5', fontFamily: 'Rajdhani, sans-serif' }}>{t}</span>
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="ui-modal-backdrop z-[90] p-2 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="ui-modal ui-modal--wide flex max-h-[92vh] flex-col"
          >
            {/* Header */}
            <div className="ui-modal__header flex-shrink-0">
              <div>
                <h2 className="ui-modal__title">Como jogar</h2>
                <p className="mt-1 text-xs text-[var(--ui-text-muted)]">Guia completo do UCL Immortals — do começo ao fim</p>
              </div>
              <button onClick={onClose} aria-label="Fechar" className="ui-icon-btn">✕</button>
            </div>

            {/* Tabs */}
            <div className="ui-guide-tabs flex-shrink-0">
              {SECTIONS.map((s, i) => (
                <button
                  key={s.label}
                  onClick={() => setTab(i)}
                  className="ui-tab"
                  data-active={tab === i}
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="ui-modal__body flex-1">
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                {SECTIONS[tab].body}
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
