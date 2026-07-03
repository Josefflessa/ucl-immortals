// UCL Immortals — Escudo FUT: o MESMO contorno + borda aprovados no teste de design.
// O `card-frame.webp` (silhueta de escudo com borda dourada + interior escuro) é usado como:
//   1) MÁSCARA (mask-image): recorta cada camada exatamente no formato do escudo;
//   2) MOLDURA visível (a borda dourada real aparece na volta).
// As camadas usam a máscara em tamanhos diferentes (inset) pra criar o anel entre a borda e a
// textura. O "FUT 19" do interior nunca aparece porque é 100% coberto pela textura.
import type { CSSProperties } from 'react';

export const FRAME_URL = '/cards/card-frame.webp';

// Máscara compartilhada (silhueta do frame). `size` faz o inset (ex.: '94.5% 95.5%').
export function frameMask(size: string): CSSProperties {
  return {
    WebkitMaskImage: `url(${FRAME_URL})`,
    maskImage: `url(${FRAME_URL})`,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: size,
    maskSize: size,
  };
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
