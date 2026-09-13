// UCL Immortals — leitura visual do impacto tático (formação/tática).
// Converte o perfil numérico do motor em três sinais fáceis de ler. Os números internos continuam
// ocultos: a interface explica a direção do efeito sem transformar o balanceamento em uma planilha.

interface Axes { attack: number; defense: number; control: number; }

// value → nível qualitativo -2..+2. Qualquer valor diferente de zero aparece como
// uma tendência leve, para que uma pequena vantagem não pareça um empate perfeito.
function level(v: number): number {
  const m = Math.abs(v);
  const mag = m >= 1.5 ? 2 : m > 0 ? 1 : 0;
  return Math.sign(v) * mag;
}

const ARROWS: Record<number, { txt: string; color: string }> = {
  2:  { txt: '▲▲', color: '#22C55E' },
  1:  { txt: '▲',  color: '#7FCF6A' },
  0:  { txt: '—',  color: '#4A4A5A' },
  [-1]: { txt: '▼',  color: '#F08A5D' },
  [-2]: { txt: '▼▼', color: '#EF4444' },
};

const STATUS: Record<number, string> = {
  2: 'Muito mais',
  1: 'Ligeiramente mais',
  0: 'Estável',
  [-1]: 'Ligeiramente menos',
  [-2]: 'Muito menos',
};

const AXES: { key: keyof Axes; label: string; explanation: string }[] = [
  { key: 'control', label: 'CONTROLE', explanation: 'Gera mais iniciativa, volume de jogadas e posse' },
  { key: 'attack',  label: 'ATAQUE',  explanation: 'Torna suas chances mais perigosas' },
  { key: 'defense', label: 'DEFESA',  explanation: 'Reduz o perigo das chances adversárias' },
];

export default function ImpactMeter({ profile }: { profile: Axes }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {AXES.map(({ key, label, explanation }) => {
        const lvl = level(profile[key]);
        const a = ARROWS[lvl];
        return (
          <div key={key} role="img" title={`${label}: ${explanation}`} aria-label={`${label}: ${STATUS[lvl]}. ${explanation}`} className="flex min-h-[68px] min-w-0 flex-col items-center justify-center rounded-lg px-2 py-2 text-center"
            style={{ background: '#0A0A14', border: '1px solid #1C1C30' }}>
            <span className="text-[10px] font-black tracking-wider" style={{ color: '#9A9AAF', fontFamily: 'Rajdhani, sans-serif' }}>
              {label}
            </span>
            <div className="mt-1 flex items-center gap-1.5 leading-none">
              <span className="text-base font-black" style={{ color: a.color }}>{a.txt}</span>
              <span className="text-xs font-bold" style={{ color: a.color }}>{STATUS[lvl]}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
