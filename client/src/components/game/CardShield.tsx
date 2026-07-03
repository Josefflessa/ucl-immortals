// UCL Immortals — Escudo FUT vetorial próprio (sem asset de terceiro), escalável a qualquer tamanho.
// O clipPath usa coords objectBoundingBox (0–1), então o MESMO recorte serve pra card de qualquer
// dimensão (grande, médio, compacto) sem recalcular geometria. A borda é um <path> com stroke de
// espessura constante (vector-effect:non-scaling-stroke). O anel metálico é um gradiente derivado
// da cor (raridade ou característica).

// Silhueta de escudo: topo com leve entalhe central, ombros curvos, base afunilando numa ponta.
export const SHIELD_D =
  'M0.5 0.012 C0.40 0.012 0.30 0.045 0.12 0.045 C0.06 0.045 0.02 0.075 0.02 0.125 ' +
  'L0.02 0.60 C0.02 0.72 0.10 0.80 0.26 0.885 C0.38 0.945 0.455 0.965 0.5 1.0 ' +
  'C0.545 0.965 0.62 0.945 0.74 0.885 C0.90 0.80 0.98 0.72 0.98 0.60 L0.98 0.125 ' +
  'C0.98 0.075 0.94 0.045 0.88 0.045 C0.70 0.045 0.60 0.012 0.5 0.012 Z';

// Montado UMA vez no app (App.tsx). Define o clipPath global referenciado por todos os cards.
export function CardShieldDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
      <defs>
        <clipPath id="uclCardShield" clipPathUnits="objectBoundingBox">
          <path d={SHIELD_D} />
        </clipPath>
      </defs>
    </svg>
  );
}

// Contorno do escudo por cima do card. `innerStroke` desenha uma segunda linha interna (imortal/selecionado).
export function ShieldBorder({ stroke, width, innerStroke }: { stroke: string; width: number; innerStroke?: string }) {
  return (
    <svg viewBox="0 0 1 1" preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}>
      <path d={SHIELD_D} fill="none" stroke={stroke} strokeWidth={width} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {innerStroke && (
        <path d={SHIELD_D} fill="none" stroke={innerStroke} strokeWidth={Math.max(1, width - 2)} vectorEffect="non-scaling-stroke"
          transform="translate(0.5 0.5) scale(0.965) translate(-0.5 -0.5)" opacity="0.8" />
      )}
    </svg>
  );
}

// Gradiente metálico diagonal derivado de uma cor: escuro → highlight → cor → highlight → escuro.
export function ringGradient(color: string): string {
  return `linear-gradient(135deg,` +
    `color-mix(in srgb,${color} 52%,#000) 0%,` +
    `color-mix(in srgb,${color} 92%,#fff) 40%,` +
    `${color} 56%,` +
    `color-mix(in srgb,${color} 78%,#fff) 70%,` +
    `color-mix(in srgb,${color} 48%,#000) 100%)`;
}
