// UCL Immortals — "Como jogar"
// Guia in-game organizado por fluxo e alimentado pelas regras atuais do jogo.
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  COACHES,
  DIFFICULTY_LEVELS,
  FORMATIONS,
  getRarityColor,
  HISTORICAL_TRIOS,
  Rarity,
  TACTICS,
} from '../../lib/gameData';
import {
  PRIME_COST,
  PRIME_WINS_REQUIRED,
  SHOP_COSTS,
  trainCost,
  TRAIN_BOOST,
  TURBINAR_VARIANTS,
} from '../../lib/shop';
import {
  COMPETITION_FORMAT_PRESETS,
  DEFAULT_POINTS_CONFIG,
  MAX_BET_ROUND_CAP,
} from '../../lib/competition';

const GOLD = '#C9A84C';

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
  return (
    <span
      className="rounded px-2 py-0.5 text-[11px] font-black"
      style={{
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
        fontFamily: 'Rajdhani, sans-serif',
      }}
    >
      {children}
    </span>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-black"
        style={{
          background: `${GOLD}22`,
          color: GOLD,
          border: `1px solid ${GOLD}55`,
          fontFamily: 'Bebas Neue, sans-serif',
        }}
      >
        {n}
      </div>
      <div className="min-w-0 flex-1 pb-1">
        <div className="text-[13px] font-black" style={{ color: '#FFF', fontFamily: 'Rajdhani, sans-serif' }}>{title}</div>
        <div className="mt-0.5 text-[12px] leading-relaxed" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>{children}</div>
      </div>
    </div>
  );
}

function InfoRow({ label, children, color = '#C9C9D5' }: { label: string; children: React.ReactNode; color?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}>
      <div className="text-[12px] font-black uppercase tracking-[0.08em]" style={{ color, fontFamily: 'Rajdhani, sans-serif' }}>{label}</div>
      <div className="mt-1 text-[12px] leading-relaxed" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>{children}</div>
    </div>
  );
}

const RARITIES: { r: Rarity; label: string; desc: string }[] = [
  { r: 'bronze', label: 'Bronze', desc: 'Jogadores comuns — a base do elenco.' },
  { r: 'silver', label: 'Prata', desc: 'Bons jogadores, peças confiáveis.' },
  { r: 'gold', label: 'Ouro', desc: 'Craques consagrados.' },
  { r: 'legendary', label: 'Lendário', desc: 'Jogadores históricos com alto potencial.' },
  { r: 'immortal', label: 'Imortal', desc: 'Ícones raros para elevar o elenco.' },
  { r: 'unique', label: 'Único', desc: 'Cartas especiais de overall 99, obtidas no pacote Único.' },
];

const ECONOMY_ITEMS = [
  { icon: '🎓', name: 'Trocar técnico', cost: SHOP_COSTS.changeCoach, d: 'Troca o comandante e, com ele, sua filosofia, bônus e formação preferida.' },
  { icon: '✨', name: 'Turbinar carta', cost: SHOP_COSTS.turbinar, d: 'Aplica uma característica especial a um jogador que ainda não tem uma.' },
  { icon: '🧹', name: 'Remover característica', cost: SHOP_COSTS.removeVariant, d: 'Remove a característica atual para liberar uma nova aplicação de Turbinar.' },
  { icon: '🌟', name: 'Pacote do Craque', cost: SHOP_COSTS.starPack, d: 'Oferece três opções de jogadores de overall 88 ou mais.' },
  { icon: '🔍', name: 'Caça-talentos', cost: SHOP_COSTS.scout, d: 'Oferece quatro opções filtradas pela posição que você precisa.' },
  { icon: '💪', name: 'Treino intensivo', cost: trainCost(0), d: `Aumenta um atributo em +${TRAIN_BOOST}; o custo sobe a cada treino no mesmo jogador.` },
  { icon: '🔄', name: 'Reroll de reforço', cost: SHOP_COSTS.reroll, d: 'Gera um token para sortear novas opções no reforço pós-partida; tokens acumulam.' },
  { icon: '⭐', name: 'Pacote Único', cost: SHOP_COSTS.uniqueCard, d: 'Compra uma carta Única aleatória de overall 99; ela pode ter até duas características.' },
  { icon: '🏥', name: 'Fisioterapia', cost: SHOP_COSTS.physio, d: 'Reduz em uma partida o período de lesão de um jogador.' },
];

export default function HowToPlayModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState(0);

  const sections: { icon: string; label: string; body: React.ReactNode }[] = [
    {
      icon: '🎮', label: 'Comece aqui',
      body: (
        <div className="space-y-4">
          <Card accent={`${GOLD}44`}>
            <H>O OBJETIVO</H>
            <P>Monte um elenco histórico e competitivo, faça boas escolhas no draft e leve seu time ao título da <b style={{ color: GOLD }}>Ultimate Champions League</b>. Você decide o formato, o nível da IA e o quanto quer personalizar as regras.</P>
          </Card>

          <Card>
            <H>O FLUXO COMPLETO</H>
            <div className="mt-2 space-y-3">
              <Step n={1} title="Configure a competição">Escolha o formato, a dificuldade e, se quiser, abra as opções avançadas para ajustar recompensas, reforços, cartões, lesões e limite de apostas.</Step>
              <Step n={2} title="Defina sua identidade">Escolha escudo, técnico e formação inicial. O técnico influencia atributos, situações especiais e a química da formação preferida.</Step>
              <Step n={3} title="Monte o elenco no draft">Faça 13 escolhas: 11 titulares e 2 reservas. Cada rodada oferece cartas, e você pode usar até 4 vetos para trocar a oferta.</Step>
              <Step n={4} title="Revise a escalação">Ajuste posições, tática, capitão e cobradores; confira a química, o estado do elenco e as indisponibilidades.</Step>
              <Step n={5} title="Jogue a competição">Acompanhe a partida ao vivo, o momentum, as estatísticas e os lances. O resultado gera pontos do torneio, créditos e, quando configurado, reforços.</Step>
              <Step n={6} title="Evolua entre os jogos">Use loja, treino, mercado e alterações no elenco. Nos formatos com mata-mata, cada confronto pode ser em ida e volta e o agregado importa.</Step>
            </div>
          </Card>

          <Card accent="#3B82F644">
            <H>BASE × EFETIVO: A REGRA MAIS IMPORTANTE</H>
            <div className="grid gap-2 sm:grid-cols-2">
              <InfoRow label="Carta / Draft / Loja / Álbum" color="#FBBF24">Mostra o valor base da carta, já com o que estiver incorporado nela, como uma característica que altera seus atributos. Não recebe buffs do seu time.</InfoRow>
              <InfoRow label="Meu Time / Partida / Resultado" color="#34D399">Mostra o valor efetivo: base + características + química + técnico + tática + capitão + treino/evolução + efeitos do time e do estádio, quando aplicáveis.</InfoRow>
            </div>
            <P><span className="mt-2 block">O overall efetivo é calculado a partir da média dos atributos efetivos e pode passar de 99. O detalhe do jogador informa a base original e a origem dos bônus.</span></P>
          </Card>

          <Card>
            <H>SOLO E ONLINE</H>
            <P>Você pode jogar sozinho contra times da IA ou em uma sala online com até 8 jogadores humanos; os espaços restantes são preenchidos por bots. No online, o draft segue uma fila em serpentina e cada participante precisa acompanhar a sua vez.</P>
          </Card>
        </div>
      ),
    },
    {
      icon: '⚙️', label: 'Configuração',
      body: (
        <div className="space-y-4">
          <Card accent={`${GOLD}44`}>
            <H>ESCOLHA O FORMATO</H>
            <div className="space-y-2">
              {Object.values(COMPETITION_FORMAT_PRESETS).map((preset) => (
                <InfoRow key={preset.id} label={`${preset.icon} ${preset.name}`} color={GOLD}>
                  {preset.description} <span style={{ color: '#D9D9E4' }}>({preset.shortDescription})</span>
                </InfoRow>
              ))}
            </div>
          </Card>

          <Card>
            <H>OPÇÕES AVANÇADAS</H>
            <div className="grid gap-2 sm:grid-cols-2">
              <InfoRow label="🩹 Lesões">Ative ou desative novas lesões durante os jogos. Com a opção ativa, uma lesão pode deixar o jogador fora por mais de uma partida.</InfoRow>
              <InfoRow label="🟨 Cartões">Ative ou desative amarelos, vermelhos e suspensões. Desligar cartões não remove as faltas: elas continuam aparecendo nas estatísticas.</InfoRow>
              <InfoRow label="🎯 Limite de apostas">Define o máximo de saldo apostado por rodada, de 0 a {MAX_BET_ROUND_CAP}. Zero desativa as apostas. Em liga e grupos, o limite é compartilhado pela rodada; no mata-mata, vale por confronto.</InfoRow>
              <InfoRow label="🔁 Ida e volta">Escolha uma ou duas partidas por confronto e se a final será jogo único. No agregado empatado, a decisão vai para prorrogação e pênaltis.</InfoRow>
            </div>
          </Card>

          <Card>
            <H>REFORÇOS E RECOMPENSAS</H>
            <P>Você pode deixar reforços desligados, recebê-los por rodada ou por fase. A janela pode ser limitada e cada oferta traz de 3 a 6 opções. Também é possível ativar/desativar os créditos da loja na liga e no mata-mata e personalizar cada valor de recompensa.</P>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip color="#34D399">Padrão: reforço por rodada</Chip>
              <Chip color="#60A5FA">Padrão: 6 opções</Chip>
              <Chip color="#FBBF24">Créditos configuráveis</Chip>
            </div>
          </Card>

          <Card>
            <H>DIFICULDADE</H>
            <div className="grid gap-2 sm:grid-cols-2">
              {DIFFICULTY_LEVELS.map((level) => (
                <InfoRow key={level.id} label={level.name} color={getRarityColor(level.id as Rarity)}>{level.description}</InfoRow>
              ))}
            </div>
          </Card>
        </div>
      ),
    },
    {
      icon: '🃏', label: 'Draft',
      body: (
        <div className="space-y-4">
          <Card accent="#60A5FA44">
            <H>COMO FUNCIONA</H>
            <P>O draft tem <b style={{ color: '#FFF' }}>13 rodadas</b>. Em cada uma, você vê 6 cartas, escolhe uma e ela ocupa a posição atual da sua formação. Durante a montagem dos titulares, o jogo garante que exista pelo menos uma opção compatível com a posição que falta; depois de completar o XI, as escolhas restantes formam o banco.</P>
            <div className="mt-2 flex flex-wrap gap-1.5"><Chip color="#60A5FA">11 titulares</Chip><Chip color="#A78BFA">2 reservas</Chip><Chip color="#FBBF24">4 vetos</Chip><Chip color="#F87171">30 s por escolha</Chip></div>
          </Card>

          <Card>
            <H>VETOS E TEMPO</H>
            <P>O veto troca a oferta atual por novas cartas, mas consome uma das 4 cargas. Se o cronômetro acabar, a escolha é feita automaticamente. No online, respeite a fila em serpentina: a ordem muda de uma rodada para outra para equilibrar as oportunidades.</P>
          </Card>

          <Card accent="#A78BFA44">
            <H>O QUE OBSERVAR NA CARTA</H>
            <div className="grid gap-2 sm:grid-cols-2">
              <InfoRow label="Overall e atributos">São os números da carta para comparação no draft. Traits e características incorporadas podem alterá-los, mas buffs do seu time ainda não entram aqui.</InfoRow>
              <InfoRow label="Posição e encaixe">Priorize quem serve para a vaga. Uma carta com posição secundária cobre funções próximas, mas sofre a penalidade correspondente; o Coringa é a exceção e cobre qualquer posição sem penalidade.</InfoRow>
              <InfoRow label="Visão e compostura">São mostradas porque alimentam criação, decisões, pênaltis e algumas habilidades de técnico/traits.</InfoRow>
              <InfoRow label="Estilos de jogo">Cada jogador recebe características aleatórias de acordo com a carta e a posição. Elas podem ser permanentes ou condicionais, como final, mata-mata ou situação do placar.</InfoRow>
            </div>
          </Card>

          <Card accent="#22C55E44"><P>💡 Não escolha apenas pelo maior overall. Uma carta que encaixa na posição e cria vínculos pode render mais no time do que um craque isolado.</P></Card>
        </div>
      ),
    },
    {
      icon: '👥', label: 'Meu Time',
      body: (
        <div className="space-y-4">
          <Card accent="#34D39944">
            <H>ESCALAÇÃO</H>
            <P>Seu elenco tem <b style={{ color: '#FFF' }}>11 titulares e 2 reservas</b>. No campo, arraste ou troque jogadores entre as posições permitidas pela formação. A disposição visual é a mesma usada nas telas de partida e de resultado, com cards simplificados e linhas de conexão.</P>
          </Card>

          <Card>
            <H>O QUE VOCÊ PODE AJUSTAR</H>
            <div className="grid gap-2 sm:grid-cols-2">
              <InfoRow label="Formação">Muda as vagas, o desenho do campo, os encaixes de posição e a química individual.</InfoRow>
              <InfoRow label="Tática">Escolha o estilo inicial. Você também pode montar até 3 mudanças automáticas para reagir ao placar durante a partida.</InfoRow>
              <InfoRow label="Funções de jogo">Defina capitão, cobrador de pênalti e cobrador de falta entre os jogadores disponíveis.</InfoRow>
              <InfoRow label="Status">Acompanhe lesões, suspensões, cartões acumulados, treinos, evolução e indisponibilidade antes de confirmar a rodada.</InfoRow>
            </div>
          </Card>

          <Card accent="#F59E0B44">
            <H>TITULAR × RESERVA</H>
            <P>Na tela Meu Time, os dois aparecem dentro do contexto do seu elenco. O titular recebe os bônus específicos de posição, química individual, capitão e escalação; o reserva mantém o contexto global do time, mas não recebe a química individual do XI até entrar em campo.</P>
            <P><span className="mt-2 block">Se um titular estiver lesionado ou suspenso e não houver cobertura no banco, o jogo oferece uma substituição emergencial para que a partida continue.</span></P>
          </Card>
        </div>
      ),
    },
    {
      icon: '⚗️', label: 'Química',
      body: (
        <div className="space-y-4">
          <Card accent="#3B82F644"><H>COMO ELA É CALCULADA</H><P>A química mede o entrosamento do XI. Cada titular recebe química individual de <b style={{ color: '#FFF' }}>0 a 3</b>, que pode multiplicar seus atributos em até 10%. A química total do time vai de 0 a 100 e aplica um bônus global aos titulares.</P></Card>

          <Card>
            <H>VÍNCULOS ENTRE JOGADORES</H>
            <P>Cada par conta no máximo o vínculo mais forte disponível:</P>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip color="#22C55E">Mesmo clube +2</Chip>
              <Chip color="#4FC3F7">Mesma nação +1</Chip>
              <Chip color="#E8C84A">Técnico histórico compartilhado +2</Chip>
              <Chip color="#A855F7">Dupla histórica +1</Chip>
              <Chip color="#F97316">Nômade: vínculo de nação +1</Chip>
            </div>
            <P><span className="mt-2 block">Além dos pares, cada jogador ligado ao técnico atual pode gerar +1. Um jogador fora de posição não gera química individual.</span></P>
          </Card>

          <Card>
            <H>MARCOS DA QUÍMICA TOTAL</H>
            <div className="grid gap-2 sm:grid-cols-2">
              <InfoRow label="45+" color="#86EFAC">+1 em todos os atributos e +2 em Passe.</InfoRow>
              <InfoRow label="60+" color="#4ADE80">+2 em todos os atributos, +2 em Passe e +2 em Ritmo.</InfoRow>
              <InfoRow label="75+" color="#22C55E">+3 em todos os atributos, +4 em Passe e +2 em Ritmo.</InfoRow>
              <InfoRow label="90+" color="#16A34A">+5 em todos os atributos, +6 em Passe e +4 em Ritmo.</InfoRow>
            </div>
          </Card>

          <Card accent="#EF444444">
            <H>FORA DE POSIÇÃO</H>
            <P>Na posição secundária, o jogador sofre uma redução de 5% nos atributos. Fora das posições compatíveis, a redução é de 15% e a química individual zera. <b style={{ color: '#FFF' }}>Coringa</b> é tratado como compatível com qualquer posição e não sofre essas penalidades.</P>
          </Card>

          <Card>
            <H>BÔNUS EXTRAS</H>
            <P>A formação preferida do técnico soma <b style={{ color: GOLD }}>+8</b> à química. Características de equipe também alteram o total: Pilar fortalece o XI, Lobo Solitário reduz a química, e combinações históricas podem dar bônus adicionais.</P>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {HISTORICAL_TRIOS.map((trio) => <InfoRow key={trio.id} label={`${trio.name} +${trio.chemBonus}`}>{trio.description}</InfoRow>)}
            </div>
          </Card>
        </div>
      ),
    },
    {
      icon: '📐', label: 'Formações',
      body: (
        <div className="space-y-3">
          <P>O desenho do campo muda a distribuição das posições, as conexões e os pontos fortes do time. A formação do técnico também é uma fonte de química. Quando uma formação leva vantagem sobre a outra, o time favorecido recebe um <b style={{ color: GOLD }}>bônus temporário durante a partida</b>.</P>
          {FORMATIONS.map((formation) => (
            <Card key={formation.id}>
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded px-2 py-0.5 text-base font-black" style={{ background: `${GOLD}22`, color: GOLD, fontFamily: 'Bebas Neue, sans-serif' }}>{formation.id}</span>
                <span className="text-[13px] font-black" style={{ color: '#FFF', fontFamily: 'Rajdhani, sans-serif' }}>{formation.name}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <InfoRow label="Pontos fortes" color="#34D399">{formation.strengths.join(' • ')}</InfoRow>
                <InfoRow label="Pontos fracos" color="#F87171">{formation.weaknesses.join(' • ')}</InfoRow>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5"><Chip color="#60A5FA">Leva vantagem contra: {formation.counters.join(', ')}</Chip><Chip color="#F97316">Pode sofrer contra: {formation.counteredBy.join(', ')}</Chip></div>
            </Card>
          ))}
        </div>
      ),
    },
    {
      icon: '📋', label: 'Táticas',
      body: (
        <div className="space-y-3">
          <Card accent="#A78BFA44"><H>PLANO DE JOGO</H><P>A tática inicial define o comportamento e os bônus do seu time. Entre as partidas, troque livremente. Durante o jogo, programe até <b style={{ color: '#FFF' }}>3 gatilhos</b> para mudar automaticamente quando estiver ganhando, empatando, perdendo, com cartão vermelho próprio ou quando o adversário receber um vermelho. Cada gatilho acontece uma vez; o vermelho é imediato.</P></Card>
          {TACTICS.map((tactic) => (
            <Card key={tactic.id}>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-lg">{tactic.icon}</span>
                <span className="text-[14px] font-black" style={{ color: '#FFF', fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.06em' }}>{tactic.name.toUpperCase()}</span>
              </div>
              <P>{tactic.desc}</P>
            </Card>
          ))}
        </div>
      ),
    },
    {
      icon: '✨', label: 'Cartas',
      body: (
        <div className="space-y-4">
          <Card accent="#A78BFA44">
            <H>RARIDADE E VALOR BASE</H>
            <P>A raridade indica a categoria histórica e visual da carta. O overall e os atributos impressos são o valor base usado para comparar jogadores fora do contexto do seu time.</P>
            <div className="mt-3 space-y-2">
              {RARITIES.map(({ r, label, desc }) => (
                <div key={r} className="flex items-center gap-3 rounded-xl p-3" style={{ background: '#0F0F1A', border: `1px solid ${getRarityColor(r)}55` }}>
                  <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ background: getRarityColor(r), boxShadow: `0 0 10px ${getRarityColor(r)}` }} />
                  <span className="w-20 flex-shrink-0 text-[14px] font-black" style={{ color: getRarityColor(r), fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.06em' }}>{label.toUpperCase()}</span>
                  <span className="text-[12px]" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>{desc}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card accent="#F59E0B44">
            <H>CARACTERÍSTICAS E ATRIBUTOS</H>
            <P>Traits são os estilos de jogo aleatórios do jogador: finalização, passe, defesa, físico, goleiro, liderança e outros. O efeito pode ser contínuo ou condicionado. Quando uma trait dá bônus, ela muda os atributos efetivos correspondentes — não apenas o número do overall.</P>
            <P><span className="mt-2 block">As características de carta, como Em Alta ou Lobo Solitário, também podem alterar os atributos. No draft, loja, álbum e escolha de reforço você vê essa versão base da carta; no Meu Time e nas partidas, os efeitos do elenco são somados por cima.</span></P>
          </Card>

          <H>CARACTERÍSTICAS ESPECIAIS</H>
          {TURBINAR_VARIANTS.map((variant) => {
            const color = variant.color === '#FFFFFF' ? '#E5E7EB' : variant.color;
            return (
              <div key={variant.key} className="flex gap-3 rounded-xl p-3" style={{ background: '#0F0F1A', border: `1px solid ${color}44` }}>
                <span className="flex-shrink-0 text-2xl">{variant.icon}</span>
                <div>
                  <div className="text-[13px] font-black" style={{ color, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.04em' }}>{variant.label.toUpperCase()}</div>
                  <div className="mt-0.5 text-[12px] leading-snug" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>{variant.desc}</div>
                </div>
              </div>
            );
          })}

          <Card accent="#22C55E44"><P>📌 Não existe teto visual de 99 para atributos efetivos. Uma carta pode mostrar seu baseOverall original nos detalhes e, no contexto do time, exibir o overall/atributos efetivos calculados.</P></Card>
        </div>
      ),
    },
    {
      icon: '🎓', label: 'Técnico',
      body: (
        <div className="space-y-4">
          <Card accent={`${GOLD}44`}><H>FILOSOFIA E FORMAÇÃO PREFERIDA</H><P>O técnico define uma filosofia, bônus gerais, uma habilidade especial e uma formação preferida. Usar essa formação concede <b style={{ color: GOLD }}>+8 de química</b>. Leia o card do técnico para saber em que fase, posição ou situação cada efeito entra.</P></Card>
          <div className="grid gap-2 sm:grid-cols-2">
            {COACHES.map((coach) => (
              <InfoRow key={coach.id} label={`${coach.name} · ${coach.preferredFormation}`} color={GOLD}>
                <b style={{ color: '#D9D9E4' }}>{coach.philosophy}.</b> {coach.effect} <span className="mt-1 block" style={{ color: '#C9A84C' }}>{coach.specialAbilityName}: {coach.specialAbility}</span>
              </InfoRow>
            ))}
          </div>
          <Card accent="#34D39944">
            <H>TÉCNICO PRIME E ESTÁDIO</H>
            <P>Depois de <b style={{ color: '#FFF' }}>{PRIME_WINS_REQUIRED} vitórias</b>, você pode evoluir o técnico por <b style={{ color: GOLD }}>{PRIME_COST} créditos</b>. O estádio Prime amplia o bônus de mando: o estádio padrão já dá +3 em todos os atributos dos titulares em casa; o Prime melhora esse impacto e adiciona bônus temáticos ligados ao clube/nação do técnico.</P>
            <P><span className="mt-2 block">O estádio só beneficia o mandante. Em final de jogo único, o campo é neutro.</span></P>
          </Card>
        </div>
      ),
    },
    {
      icon: '⚽', label: 'Partidas',
      body: (
        <div className="space-y-4">
          <Card accent="#60A5FA44">
            <H>DURANTE O JOGO</H>
            <P>A partida simula os 90 minutos, com prorrogação até 120 quando o mata-mata exigir. Você acompanha placar, momentum, posse, finalizações, finalizações no alvo, faltas, defesas e escanteios, além do feed de lances.</P>
            <div className="mt-2 flex flex-wrap gap-1.5"><Chip color="#60A5FA">Posse</Chip><Chip color="#FBBF24">Chutes</Chip><Chip color="#F87171">Cartões</Chip><Chip color="#34D399">Defesas</Chip><Chip color="#A78BFA">Momentum</Chip></div>
          </Card>

          <Card>
            <H>EVENTOS E ESTATÍSTICAS</H>
            <P>O motor pode gerar gols, assistências, chutes, defesas, escanteios, faltas, amarelos, vermelhos e lesões. No detalhe da partida, você pode alternar entre os times, rever a formação no campo e conferir gols, assistências, notas finais e a tática usada.</P>
            <P><span className="mt-2 block">A nota do jogador é desempenho naquela partida; ela não é o overall base nem substitui o overall efetivo do elenco.</span></P>
          </Card>

          <Card accent="#F59E0B44">
            <H>DISCIPLINA</H>
            <div className="grid gap-2 sm:grid-cols-2">
              <InfoRow label="Amarelos">O jogador acumula cartões; ao chegar a 3 amarelos acumulados, cumpre 1 partida de suspensão e a contagem é reiniciada.</InfoRow>
              <InfoRow label="Vermelho">O jogador é expulso e fica suspenso por 1 partida. Para goleiros, a penalidade é mais pesada.</InfoRow>
              <InfoRow label="Lesão">Uma lesão pode deixar o jogador indisponível por 1 a 3 partidas. A fisioterapia reduz uma partida do período.</InfoRow>
              <InfoRow label="Configuração">Se cartões ou lesões forem desligados no torneio, novos eventos desse tipo não são gerados; faltas continuam existindo.</InfoRow>
            </div>
          </Card>

          <Card><H>MANDO E PÊNALTIS</H><P>O mandante recebe a vantagem do estádio. Em confrontos com agregado empatado, há prorrogação e depois pênaltis; a compostura dos cobradores e o desempenho do goleiro fazem diferença.</P></Card>
        </div>
      ),
    },
    {
      icon: '🛒', label: 'Economia',
      body: (
        <div className="space-y-4">
          <Card accent="#34D39944">
            <H>CRÉDITOS DA LOJA</H>
            <P>Créditos são uma moeda de evolução, separada dos pontos da classificação. Com créditos ativos, você recebe recompensas por resultado, saldo de gols, gols marcados e jogo sem sofrer gol. Os valores podem ser personalizados na configuração da competição.</P>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <InfoRow label="Vitória" color="#34D399">+{DEFAULT_POINTS_CONFIG.win}</InfoRow>
              <InfoRow label="Empate" color="#FBBF24">+{DEFAULT_POINTS_CONFIG.draw}</InfoRow>
              <InfoRow label="Derrota" color="#F87171">+{DEFAULT_POINTS_CONFIG.loss}</InfoRow>
              <InfoRow label="Saldo positivo" color="#60A5FA">+{DEFAULT_POINTS_CONFIG.goalDifference} por saldo</InfoRow>
              <InfoRow label="Gol marcado" color="#A78BFA">+{DEFAULT_POINTS_CONFIG.goal}</InfoRow>
              <InfoRow label="Clean sheet" color="#22C55E">+{DEFAULT_POINTS_CONFIG.cleanSheet}</InfoRow>
            </div>
          </Card>

          <Card>
            <H>APOSTAS</H>
            <P>Você pode apostar no vencedor ou no placar exato quando a aposta estiver disponível. Acertar o resultado paga <b style={{ color: '#34D399' }}>1,5×</b> o valor apostado; acertar o placar exato paga <b style={{ color: '#34D399' }}>2,5×</b>. Errar perde a stake. O limite configurado vale para o total apostado no escopo da rodada ou do confronto.</P>
          </Card>

          <H>LOJA</H>
          {ECONOMY_ITEMS.map((item) => (
            <div key={item.name} className="flex items-center gap-3 rounded-xl p-3" style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}>
              <span className="flex-shrink-0 text-xl">{item.icon}</span>
              <div className="min-w-0 flex-1"><div className="text-[13px] font-black" style={{ color: '#FFF', fontFamily: 'Rajdhani, sans-serif' }}>{item.name}</div><div className="text-[11px] leading-snug" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>{item.d}</div></div>
              <span className="flex-shrink-0 rounded px-2 py-0.5 text-[12px] font-black" style={{ background: '#E8C84A22', color: '#E8C84A', fontFamily: 'Bebas Neue, sans-serif' }}>💰 {item.cost}</span>
            </div>
          ))}

          <Card>
            <H>MERCADO</H>
            <P>Reservas podem ser vendidas ao banco por um valor definido pela raridade. No online, também é possível anunciar uma reserva para outro jogador e comprar uma carta listada, desde que você tenha saldo e ainda não possua aquele jogador.</P>
          </Card>
        </div>
      ),
    },
    {
      icon: '🏆', label: 'Mata-mata',
      body: (
        <div className="space-y-4">
          <Card accent={`${GOLD}44`}><H>CAMINHO ATÉ A FINAL</H><P>Dependendo do formato, você pode passar por fase de liga, grupos, playoffs, oitavas, quartas, semifinais e final. A tela de competição mostra tabela, confrontos, resultados, artilharia, assistências, notas, goleiros, desarmes e cartões.</P></Card>
          <Card><H>AGREGADO E FORMATO DOS JOGOS</H><P>Confrontos de ida e volta são decididos pelo placar agregado. A final pode ser jogo único ou ida e volta, conforme a configuração. O mando muda entre os jogos; a final única é disputada em campo neutro.</P></Card>
          <Card accent="#F59E0B44"><H>EMPATE</H><P>Se o agregado terminar empatado, o jogo usa prorrogação e, persistindo a igualdade, pênaltis. O cobrador oficial recebe o benefício de compostura, e traits, goleiro e capitão podem influenciar o contexto.</P></Card>
          <Card><H>REFORÇO PÓS-PARTIDA</H><P>Quando o formato e a janela de recompensas permitem, após a rodada ou fase você escolhe uma nova carta entre as opções apresentadas. Um token de reroll permite renovar a oferta sem apagar a escolha já feita.</P></Card>
        </div>
      ),
    },
    {
      icon: '💡', label: 'Dicas',
      body: (
        <div className="space-y-4">
          <Card accent="#22C55E44"><H>CHECKLIST ANTES DE CONFIRMAR</H><div className="grid gap-2 sm:grid-cols-2"><Chip color="#34D399">Todos os titulares na posição</Chip><Chip color="#60A5FA">Química total revisada</Chip><Chip color="#FBBF24">Capitão escolhido</Chip><Chip color="#FBBF24">Pênalti e falta definidos</Chip><Chip color="#F87171">Indisponíveis conferidos</Chip><Chip color="#A78BFA">Plano de jogo preparado</Chip></div></Card>
          {[
            'Química quase sempre vale mais que um overall isolado: 11 craques soltos podem render menos que um time bem conectado.',
            'Combine técnico e formação preferida para ganhar química sem gastar nada.',
            'Olhe os atributos que a tática realmente favorece, não apenas o overall impresso.',
            'Reserve um banco funcional: lesões, cartões e suspensões podem mudar a escalação de uma rodada para outra.',
            'No mata-mata, use o plano de jogo para reagir ao placar e trate o mando como uma vantagem, não como garantia.',
            'Separe seus recursos: créditos compram evolução; pontos de classificação e saldo de apostas têm funções diferentes.',
          ].map((tip) => (
            <div key={tip} className="flex gap-2.5 rounded-xl p-3" style={{ background: '#0F0F1A', border: '1px solid #1A1A2A' }}>
              <span className="flex-shrink-0 text-base">💡</span>
              <span className="text-[12.5px] leading-relaxed" style={{ color: '#C9C9D5', fontFamily: 'Rajdhani, sans-serif' }}>{tip}</span>
            </div>
          ))}
          <Card>
            <H>GLOSSÁRIO RÁPIDO</H>
            <div className="grid gap-2 sm:grid-cols-2"><InfoRow label="Base">Valor da carta fora do contexto do elenco.</InfoRow><InfoRow label="Efetivo">Valor calculado com todos os bônus válidos naquele contexto.</InfoRow><InfoRow label="Trait">Estilo de jogo/ habilidade do jogador.</InfoRow><InfoRow label="Característica">Modificador especial aplicado à carta.</InfoRow><InfoRow label="OOP">Jogador fora da posição compatível.</InfoRow><InfoRow label="Crédito">Moeda da loja e da evolução.</InfoRow></div>
          </Card>
        </div>
      ),
    },
  ];

  const goToTab = (nextTab: number) => setTab(Math.max(0, Math.min(sections.length - 1, nextTab)));
  const currentSection = sections[tab];

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
            onClick={(event) => event.stopPropagation()}
            className="ui-modal ui-modal--wide flex max-h-[92vh] flex-col"
          >
            <div className="ui-modal__header flex-shrink-0">
              <div>
                <h2 className="ui-modal__title">Como jogar</h2>
                <p className="mt-1 text-xs text-[var(--ui-text-muted)]">Guia completo e atualizado do UCL Immortals</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-[var(--ui-border)] px-2 py-1 text-[10px] font-black text-[var(--ui-text-muted)]">{tab + 1}/{sections.length}</span>
                <button onClick={onClose} aria-label="Fechar" className="ui-icon-btn">✕</button>
              </div>
            </div>

            <div className="ui-guide-tabs flex-shrink-0" role="tablist" aria-label="Seções do guia">
              {sections.map((section, index) => (
                <button
                  key={section.label}
                  onClick={() => goToTab(index)}
                  className="ui-tab"
                  data-active={tab === index}
                  role="tab"
                  aria-selected={tab === index}
                >
                  {section.icon} {section.label}
                </button>
              ))}
            </div>

            <div className="ui-modal__body flex-1">
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} role="tabpanel">
                {currentSection.body}
              </motion.div>
            </div>

            <div className="ui-modal__footer flex-shrink-0 items-center justify-between gap-3">
              <span className="text-[11px] text-[var(--ui-text-muted)]">{currentSection.icon} {currentSection.label}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={tab === 0}
                  onClick={() => goToTab(tab - 1)}
                  className="rounded-lg border border-[var(--ui-border)] px-3 py-2 text-[11px] font-black text-[var(--ui-text-soft)] transition hover:border-[var(--ui-accent)] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  ← Anterior
                </button>
                <button
                  type="button"
                  disabled={tab === sections.length - 1}
                  onClick={() => goToTab(tab + 1)}
                  className="rounded-lg border border-[var(--ui-accent)] bg-[var(--ui-accent-soft)] px-3 py-2 text-[11px] font-black text-[var(--ui-text)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Próximo →
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
