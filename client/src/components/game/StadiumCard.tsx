import { useState } from 'react';
import { Stadium, DEFAULT_STADIUM } from '../../lib/stadium';
import { PRIME_THEMED_BONUS, PRIME_THEMED_CLUB_BONUS } from '../../lib/gameEngine';

const ATTR_PT: Record<string, string> = { pace: 'Ritmo', shooting: 'Finalização', passing: 'Passe', dribbling: 'Drible', defending: 'Defesa', physical: 'Físico', vision: 'Visão', composure: 'Compostura' };

interface StadiumCardProps {
  stadium?: Stadium;
  variant?: 'full' | 'venue';
  bare?: boolean;      // sem container externo — pra compor no painel único
  homeName?: string;   // no venue: "Casa do {homeName}"
}

// Card do estádio. 'full' = card completo (MEU TIME / fim de campanha) com destaque do buff de casa.
// 'venue' = "pill" enxuto do palco da partida (header do placar).
export default function StadiumCard({ stadium = DEFAULT_STADIUM, variant = 'full', bare = false, homeName }: StadiumCardProps) {
  const [imgOk, setImgOk] = useState(true);

  if (variant === 'venue') {
    return (
      <div className="inline-flex items-center gap-2 pl-1.5 pr-3.5 py-1 rounded-full"
        style={{ background: '#0e0e1a', border: `1px solid ${stadium.prime ? '#E8C84A44' : '#20203385'}` }}>
        <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0" style={{ border: `1px solid ${stadium.prime ? '#E8C84A88' : '#2a2a3a'}`, background: 'linear-gradient(135deg,#12203a,#0A0A12)' }}>
          {imgOk ? (
            <img src={stadium.photoUrl} alt={stadium.name} className="w-full h-full object-cover" onError={() => setImgOk(false)} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[11px]">🏟️</div>
          )}
        </div>
        <span className="text-[11px] sm:text-xs font-black tracking-wide leading-none" style={{ fontFamily: 'Rajdhani, sans-serif', color: stadium.prime ? '#E8C84A' : '#DADAE6' }}>
          {stadium.name}
          {homeName ? <span style={{ color: '#7A7A8A', fontWeight: 700 }}> · Casa do {homeName}</span> : null}
        </span>
      </div>
    );
  }

  return (
    <div className={bare ? '' : 'rounded-xl overflow-hidden'} style={bare ? undefined : { background: '#0F0F1A', border: '1px solid #1A1A2A' }}>
      <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: '#1A1A2A', background: '#0A0A12' }}>
        <span className="text-[10px] font-black tracking-widest" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>🏟️ ESTÁDIO</span>
        <span className="text-[9px] font-bold tracking-wider" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>SUA CASA</span>
      </div>
      <div className="p-4 flex gap-3.5 items-center">
        {/* Foto quadrada (com fallback), no estilo do card do técnico — só um pouco maior */}
        <div className="w-[120px] h-[120px] rounded-xl overflow-hidden flex-shrink-0" style={{ border: `2px solid ${stadium.prime ? '#E8C84A88' : '#16A34A55'}`, background: 'linear-gradient(135deg, #12203a 0%, #0A0A12 100%)' }}>
          {imgOk ? (
            <img src={stadium.photoUrl} alt={stadium.name} onError={() => setImgOk(false)} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl opacity-60">🏟️</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-black leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>{stadium.name}</div>
          {stadium.prime && stadium.themedAttrs ? (
            <>
              <div className="text-[11px] font-black mt-1 leading-tight" style={{ color: '#E8C84A', fontFamily: 'Rajdhani, sans-serif' }}>
                🏠 Em casa: +{stadium.homeAttrBonus} em todos os atributos de todos os titulares
              </div>
              <div className="text-[10px] font-bold leading-snug mt-0.5" style={{ color: '#22C55E', fontFamily: 'Rajdhani, sans-serif' }}>
                ⚡ {stadium.themedAttrs.map(a => ATTR_PT[a]).join(' e ')}: <b>+{PRIME_THEMED_BONUS}</b> pra todos, <b>+{PRIME_THEMED_CLUB_BONUS}</b> pros jogadores {stadium.themedClub ? `do ${stadium.themedClub}` : `de ${stadium.themedNation}`}
              </div>
              <div className="text-[10px] leading-snug mt-0.5" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>Vale só como mandante · não vale na final.</div>
            </>
          ) : (
            <>
              <div className="text-[11px] font-black mt-1 leading-tight" style={{ color: '#22C55E', fontFamily: 'Rajdhani, sans-serif' }}>
                🏠 Em casa: +{stadium.homeAttrBonus} em TODOS os atributos de TODOS os seus titulares
              </div>
              <div className="text-[10px] leading-snug mt-0.5" style={{ color: '#8A8A9A', fontFamily: 'Rajdhani, sans-serif' }}>
                Vale só quando você é o mandante · não vale na final (campo neutro).
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
