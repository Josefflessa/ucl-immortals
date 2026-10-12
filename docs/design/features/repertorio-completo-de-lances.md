# Feature: Repertório Completo de Lances
**Data**: 2026-10-11 · **Tamanho**: G · **Status**: em construção (lotes 2–4); lote 1 adiado

## Pitch
Mais do mesmo, de formas diferentes: cada tipo de lance ganha novas variações, novos
desfechos e alguns épicos raros — todos coreografados com o mesmo cuidado (3 atos, 22
jogadores vivos, física real, narração certa).

## Objetivo / fantasia
Equilibrado: tensão, variedade e momentos memoráveis. "Toda partida mostra algo que eu
ainda não tinha visto."

## Padrão de qualidade (vale para todo lance novo)
- 3 atos: preparação → gatilho → desfecho, + reação.
- Os 22 reagem: linha sobe/recompõe, marcação acompanha, goleiro ajusta ao ângulo.
- Física: passe 15–25 m/s, chute 25–35 m/s, cruzamento com curva e altura.
- Câmera enquadra o gatilho e fecha no desfecho; épicos em câmera lenta.
- Narração: 3+ frases por variação × desfecho, nomes certos (autor, assistente).
- Auditoria automática (dentro do campo, velocidade máx., último toque do autor) e
  galeria `#lances` com todas as combinações.

## Lotes
1. **Lances Salvos** (ADIADO): animar o desfecho `duel` (carrinho, interceptação, duelo
   aéreo, goleiro sai/soca/líbero/abafa, recuperação, bandeira).
2. **Variações novas** dentro dos 13 tipos atuais (72 → ~104).
3. **Desfechos novos** (20 → 29): gol por baixo das pernas, travessão e dentro, quicando;
   defesa com uma mão, reflexo, goleiro fecha o ângulo; rede pelo lado de fora, raspando a
   trave, chute mascado.
4. **Épicos novos**: escorpião, rabona, travessão-linha-fora, pênalti defendido + rebote.

## Interação com sistemas existentes
- Motor decide autor/resultado/assistência; a animação só mostra (spec dos lances épicos).
- `playVariants.ts` (variações/desfechos), scripts do campo, narração, raridade dos épicos.
- Snapshot do motor muda só no texto sorteado, não nos resultados.

## Fora do escopo
- VAR. Animação que muda resultado/autor. Interrupção que inventa falta/cartão/escanteio.
- Assinatura de jogada por jogador/Única (talvez depois).

## Riscos
- Volume (~45 coreografias): lotes + auditoria automática.
- Épico banal: calibrar raridade como os atuais.

## Ideias descartadas nesta sessão
- VAR (usuário não quer). Gol de cabeça do goleiro (motor não faz goleiro autor).
