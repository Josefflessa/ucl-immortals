// UCL Immortals — Assinaturas do Técnico Prime.
// Os textos deste catálogo são a fonte única da explicação exibida no modal.
// Os valores numéricos são aplicados pelo motor, na mesma habilidade especial
// que o técnico já possui no nível normal.

export interface CoachPrimeDefinition {
  name: string;
  normal: string;
  prime: string;
  condition: string;
}

export const COACH_PRIME_DEFINITIONS: Record<string, CoachPrimeDefinition> = {
  guardiola: {
    name: 'Controle Total',
    normal: 'Jogadores com Visão 80 ou mais recebem +3 em tudo.',
    prime: 'Jogadores com Visão 80 ou mais recebem +7 em tudo.',
    condition: 'Ativo quando o jogador tem Visão 80 ou mais.',
  },
  klopp: {
    name: 'Pressão Implacável',
    normal: 'Quando o time está perdendo, todos recebem +8 em tudo.',
    prime: 'Quando o time está perdendo, todos recebem +14 em tudo.',
    condition: 'Ativo enquanto o seu time estiver atrás no placar.',
  },
  mourinho: {
    name: 'Bloco de Ferro',
    normal: 'No mata-mata, defensores recebem +6 em Defesa.',
    prime: 'No mata-mata, defensores recebem +12 em Defesa.',
    condition: 'Ativo para defensores durante partidas do mata-mata.',
  },
  ancelotti: {
    name: 'Jogo Grande',
    normal: 'Na final, todos recebem +6 em tudo.',
    prime: 'Na final, todos recebem +12 em tudo.',
    condition: 'Ativo somente durante a final da competição.',
  },
  zidane: {
    name: 'Galácticos em Cena',
    normal: 'No mata-mata, Lendários e Imortais recebem +6 em tudo.',
    prime: 'No mata-mata, Lendários e Imortais recebem +10 em tudo.',
    condition: 'Ativo para cartas Lendárias e Imortais no mata-mata.',
  },
  ferguson: {
    name: 'Virada Histórica',
    normal: 'Quando o time está perdendo, todos recebem +10 em tudo.',
    prime: 'Quando o time está perdendo, todos recebem +16 em tudo.',
    condition: 'Ativo enquanto o seu time estiver atrás no placar.',
  },
  luis_enrique: {
    name: 'Vertigem',
    normal: 'Meio-campistas recebem +3 Visão; atacantes, +2 Ritmo e Drible.',
    prime: 'Meio-campistas recebem +7 Visão; atacantes, +6 Ritmo e Drible.',
    condition: 'Ativo nos meio-campistas e atacantes elegíveis do time.',
  },
};

export function coachPrimeDefinition(coachId: string): CoachPrimeDefinition | null {
  return COACH_PRIME_DEFINITIONS[coachId] ?? null;
}
