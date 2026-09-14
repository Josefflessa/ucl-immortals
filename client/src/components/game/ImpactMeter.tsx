// UCL Immortals — leitura visual do impacto tático (formação/tática).
// Converte o perfil numérico do motor em três sinais fáceis de ler. Os números internos continuam
// ocultos: a interface explica a direção do efeito sem transformar o balanceamento em uma planilha.

interface Axes { attack: number; defense: number; control: number; }

// value → nível qualitativo -3..+3. A escala mantém uma categoria intermediária para
// que impactos médios não sejam apresentados como "muito".
function level(v: number): number {
  const m = Math.abs(v);
  const mag = m >= 2 ? 3 : m >= 1 ? 2 : m > 0 ? 1 : 0;
  return Math.sign(v) * mag;
}

const ARROWS: Record<number, { txt: string; color: string }> = {
  1:  { txt: '▲',  color: '#7FCF6A' },
  2:  { txt: '▲▲', color: '#4ADE80' },
  3:  { txt: '▲▲▲', color: '#22C55E' },
  0:  { txt: '—',  color: '#4A4A5A' },
  [-1]: { txt: '▼',  color: '#F08A5D' },
  [-2]: { txt: '▼▼', color: '#FB923C' },
  [-3]: { txt: '▼▼▼', color: '#EF4444' },
};

const STATUS: Record<number, string> = {
  1: 'Ligeiramente mais',
  2: 'Mais',
  3: 'Muito mais',
  0: 'Estável',
  [-1]: 'Ligeiramente menos',
  [-2]: 'Menos',
  [-3]: 'Muito menos',
};

const AXES: { key: keyof Axes; label: string; explanation: string }[] = [
  { key: 'control', label: 'CONTROLE', explanation: 'Gera mais iniciativa, volume de jogadas e posse' },
  { key: 'attack',  label: 'ATAQUE',  explanation: 'Torna suas chances mais perigosas' },
  { key: 'defense', label: 'DEFESA',  explanation: 'Reduz o perigo das chances adversárias' },
];

export default function ImpactMeter({ profile }: { profile: Axes }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {AXES.map(({ key, label, explanation }) => {
        const lvl = level(profile[key]);
        const a = ARROWS[lvl];
        return (
          <div key={key} role="img" title={`${label}: ${explanation}`} aria-label={`${label}: ${STATUS[lvl]}. ${explanation}`} className="flex min-h-[64px] min-w-0 overflow-hidden flex-col items-center justify-center rounded-lg px-1.5 py-1.5 text-center"
            style={{ background: '#0A0A14', border: '1px solid #1C1C30' }}>
            <span className="text-[9px] font-black tracking-[0.08em]" style={{ color: '#9A9AAF', fontFamily: 'Rajdhani, sans-serif' }}>
              {label}
            </span>
            <div className="mt-1 flex min-w-0 max-w-full items-center justify-center gap-0.5 leading-tight">
              <span className="shrink-0 text-sm font-black" style={{ color: a.color }}>{a.txt}</span>
              <span className="min-w-0 whitespace-normal break-normal text-[9px] font-bold leading-[1.05] tracking-[-0.02em]" style={{ color: a.color }}>{STATUS[lvl]}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
