# Padronização estrutural dos modais

Data: 2026-09-26 · Branch: `master` (versão "clássica" do design, sem o redesign visual descartado antes)

## Problema

Levantamento factual (24 modais de conteúdo + 6 `ConfirmDialog` de sim/não) encontrou 3 tecnologias de overlay coexistindo (Radix `Dialog`, Radix `AlertDialog` via `ConfirmDialog`, e `fixed inset-0` feito à mão), com:
- botão de fechar em 36px, 40px, 44px, um glifo sem caixa, uma classe CSS inexistente (`ui-modal__close`, usada em 2 modais de `ClubProjectsTab.tsx`), ou nenhum X;
- 5 modais que não fecham por X, Esc nem clique fora, aparentemente por esquecimento (não são decisões obrigatórias);
- z-index solto (50/60/70/90/100/101) sem escala documentada;
- nenhum overlay manual reage a Esc, só os baseados em Radix.

## Objetivo

Uma única estrutura para todo modal de conteúdo do jogo: mesmo botão de fechar (tamanho, ícone, posição), mesmo comportamento de fechar (X + Esc + clique fora, exceto onde a decisão é obrigatória), mesmo cabeçalho, mesma rolagem interna, escala de z-index consistente. **Nenhuma cor, fonte, borda, texto ou lógica de jogo muda.**

## Fora do escopo

- Os 6 `ConfirmDialog` (Radix `AlertDialog`: sair da sala, transferir anfitrião, remover jogador, confirmar evolução de projeto) já são consistentes entre si e não têm X por design (são diálogos de decisão sim/não). Ficam como estão.
- `UniquePackOpening` continua em tela cheia sem cabeçalho de modal — isso é intencional (a abertura do pacote é a própria experiência). Só o botão de fechar dela é padronizado.
- Nenhuma mudança em `client/src/lib`, `server/`, `shared/` ou em qualquer regra de jogo.

## Solução: componente `GameModal`

Novo export em `client/src/design-system/patterns.tsx`, construído sobre o Radix `Dialog` (para Esc e trava de foco de verdade) e estilizado com as classes que **já existem** em `tokens.css` (`.ui-modal-backdrop`, `.ui-modal`, `.ui-modal--wide`, `.ui-modal__header`, `.ui-modal__title`, `.ui-modal__body`, `.ui-modal__footer`, `.ui-icon-btn`) — nenhuma cor/fonte nova.

```tsx
interface GameModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;        // .ui-modal__title
  subtitle?: ReactNode;      // texto pequeno abaixo/ao lado do título
  headerExtra?: ReactNode;   // ex.: contador de abas do "Como jogar"
  footer?: ReactNode;        // .ui-modal__footer
  size?: 'default' | 'wide'; // .ui-modal / .ui-modal--wide
  stacked?: boolean;         // true = z-index acima de outro modal já aberto (ex.: confirmação de compra sobre o modal do item)
  dismissible?: boolean;     // default true: X + Esc + clique fora. false: nenhum dos três (decisão obrigatória)
  closeLabel?: string;       // aria-label do X; default "Fechar"
  bodyClassName?: string;
  className?: string;
  children: ReactNode;
}
```

Regras fixas do componente (não configuráveis por quem usa):
- X sempre 40×40px (`.ui-icon-btn`), ícone lucide `X`, canto superior direito do cabeçalho, sempre com `aria-label`.
- `dismissible=false` esconde o X e desliga Esc/clique-fora — quem fecha é só o botão de ação específico (recrutamento, disputa de pênaltis, escalação inválida).
- Duas camadas de z-index: base (modal comum) e `stacked` (um modal por cima de outro já aberto — só usado onde o levantamento comprovou a necessidade: confirmação de compra sobre o modal do item da loja, pacote único sobre a loja).
- Corpo sempre com rolagem interna (`.ui-modal__body`), sem `max-height` custom por tela.

## Migração (24 modais)

Cada um passa a renderizar via `<GameModal>`, mantendo os mesmos textos, cores (herdadas das classes) e — mais importante — a mesma lógica/estado/handlers. Only os seguintes comportamentos de fechar mudam (correção de bug, aprovada com o usuário):

| Modal | Antes | Depois |
|---|---|---|
| SquadEditor "Gerenciar posição" | sem X, sem backdrop, sem Esc | X + Esc + backdrop (`dismissible` padrão) |
| SquadEditor "Zoom do card" | X 44px, sem aria-label | X 40px padrão + aria-label |
| MatchSimPage "Squad modal" | X sem caixa, sem aria-label, sem backdrop/Esc | X + Esc + backdrop padrão |
| ClubProjectsTab "Ver níveis" / "Centro de treinamento" | classe `ui-modal__close` inexistente | X padrão (`.ui-icon-btn`) |
| Demais (LeaguePage recrutamento, KnockoutTiesTab/LeaguePage "escalação inválida", MatchSimPage pênaltis) | sem X, sem backdrop/Esc (decisão obrigatória) | continuam sem X/Esc/backdrop, agora via `dismissible={false}` explícito — mesmo comportamento, intencional |

Todos os outros (BetSlipModal, MatchDetailsModal, MatchCreditsModal, HowToPlayModal, FormationPreviewModal, ChemistryBonusInfo, CoachStadiumPanel, MarketTab ×2, AlbumPage ×2, SquadEditor "Config. de campo"/"Confirmar fisioterapia"/"Quick swap") migram 1:1 sem mudança de comportamento, só padronizando o X e a escala de z-index.

## Verificação

- `tsc --noEmit` e `vite build` limpos.
- Nenhum arquivo de `lib/`, `server/`, `shared/` tocado.
- Conferência visual de uma amostra (bet slip, projeto do clube, pacote único, gerenciar posição) no navegador.
