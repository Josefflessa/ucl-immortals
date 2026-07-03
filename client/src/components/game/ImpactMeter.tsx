// UCL Immortals — Impact meter (prévia qualitativa de tática/formação)
// Converte o perfil numérico do motor (attack/defense/control — de tacticProfile / formationProfile)
// em SETAS por eixo, pra o jogador enxergar de relance o que cada escolha favorece e o que custa.
// Qualitativo de propósito: NÃO mostra números crus (não expõe o balanceamento nem confunde).

interface Axes { attack: number; defense: number; control: number; }

// value → nível qualitativo -2..+2. Depois do nivelamento, tilts pequenos (|v|<0.5) leem como neutro
// — o que é fiel: as opções ficaram próximas, só as identidades fortes aparecem como seta cheia.
function level(v: number): number {
  const m = Math.abs(v);
  const mag = m >= 1.5 ? 2 : m > 0.5 ? 1 : 0;
  return Math.sign(v) * mag;
}

const ARROWS: Record<number, { txt: string; color: string }> = {
  2:  { txt: '▲▲', color: '#22C55E' },
  1:  { txt: '▲',  color: '#7FCF6A' },
  0:  { txt: '—',  color: '#4A4A5A' },
  [-1]: { txt: '▼',  color: '#F08A5D' },
  [-2]: { txt: '▼▼', color: '#EF4444' },
};

const AXES: { key: keyof Axes; label: string }[] = [
  { key: 'attack',  label: 'ATAQUE' },
  { key: 'defense', label: 'DEFESA' },
  { key: 'control', label: 'CONTROLE' },
];

export default function ImpactMeter({ profile }: { profile: Axes }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {AXES.map(({ key, label }) => {
        const lvl = level(profile[key]);
        const a = ARROWS[lvl];
        return (
          <div key={key} className="flex flex-col items-center rounded-md py-1"
            style={{ background: '#0A0A14', border: '1px solid #16162A' }}>
            <span className="text-[8px] font-black tracking-wider" style={{ color: '#7A7A8A', fontFamily: 'Rajdhani, sans-serif' }}>
              {label}
            </span>
            <span className="text-xs font-black leading-none mt-0.5" style={{ color: a.color }}>
              {a.txt}
            </span>
          </div>
        );
      })}
    </div>
  );
}
