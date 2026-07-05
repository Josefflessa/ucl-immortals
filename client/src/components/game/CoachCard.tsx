import { Coach, Formation } from '../../lib/gameData';
import { PREFERRED_FORMATION_CHEM_BONUS } from '../../lib/gameEngine';

interface CoachCardProps {
  coach: Coach;
  formation?: Formation;
  isPrime?: boolean;       // Fase 2 (Técnico Prime): selo PRIME + foto/moldura quando evoluído
  primePhotoUrl?: string;  // foto Prime do técnico (do estádio temático)
  bare?: boolean;          // sem container externo — pra compor no painel único
}

// Card do técnico — extraído do inline da SquadEditor pra ser reusado (MEU TIME + fim de campanha).
export default function CoachCard({ coach, formation, isPrime = false, primePhotoUrl, bare = false }: CoachCardProps) {
  const photo = isPrime && primePhotoUrl ? primePhotoUrl : coach.photoUrl;
  return (
    <div className={bare ? '' : 'rounded-xl overflow-hidden'} style={bare ? undefined : { background: '#0F0F1A', border: `1px solid ${isPrime ? '#C9A84C55' : '#1A1A2A'}` }}>
      <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: '#1A1A2A', background: '#0A0A12' }}>
        <span className="text-[10px] font-black tracking-widest" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>🎓 TÉCNICO</span>
        <span className="text-[9px] font-bold tracking-wider" style={{ color: '#6A6A7A', fontFamily: 'Rajdhani, sans-serif' }}>COMANDO DO TIME</span>
      </div>
      <div className="p-4 flex gap-3.5">
        {photo && (
          <div className="relative w-[100px] h-[100px] flex-shrink-0">
            <img src={photo} alt={coach.name} referrerPolicy="no-referrer" className="w-[100px] h-[100px] rounded-xl object-cover"
              style={{ border: `2px solid ${isPrime ? '#E8C84A' : '#C9A84C55'}`, objectPosition: 'center top' }} />
            {isPrime && <img src="/coaches/prime/moldura.webp" alt="" aria-hidden className="absolute inset-0 w-full h-full pointer-events-none" />}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-lg font-black leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#FFF' }}>{coach.name}</div>
            {isPrime && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded leading-none" style={{ background: 'linear-gradient(90deg, #C9A84C, #E8C84A)', color: '#0A0A12', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.1em' }}>PRIME</span>
            )}
          </div>
          <div className="text-[11px] font-bold mt-0.5" style={{ color: '#C9A84C', fontFamily: 'Rajdhani, sans-serif' }}>{coach.philosophy}</div>
          <div className="text-[11px] mt-1 leading-snug" style={{ color: '#9A9AAA', fontFamily: 'Rajdhani, sans-serif' }}>{coach.description}</div>
        </div>
      </div>
      <div className="px-4 pb-4 space-y-2">
        <div className="rounded-lg px-3 py-2" style={{ background: '#0A0A12', border: '1px solid #1A1A2A' }}>
          <div className="text-[9px] font-black tracking-widest mb-1" style={{ color: '#E8C84A', fontFamily: 'Rajdhani, sans-serif' }}>⚡ EFEITO NO ELENCO</div>
          <div className="text-[11px] leading-snug" style={{ color: '#C9C9D5', fontFamily: 'Rajdhani, sans-serif' }}>{coach.effect}</div>
        </div>
        <div className="rounded-lg px-3 py-2" style={{ background: '#0A0A12', border: '1px solid #2A2A4A' }}>
          <div className="text-[9px] font-black tracking-widest mb-1" style={{ color: '#A78BFA', fontFamily: 'Rajdhani, sans-serif' }}>✨ HABILIDADE: {coach.specialAbilityName?.toUpperCase()}</div>
          <div className="text-[11px] leading-snug" style={{ color: '#C9C9D5', fontFamily: 'Rajdhani, sans-serif' }}>{coach.specialAbility}</div>
        </div>
        {coach.preferredFormation && (
          <div className="flex items-center gap-2 text-[10px] pt-0.5 flex-wrap" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
            <span style={{ color: '#6A6A7A' }}>Formação preferida:</span>
            <span className="px-2 py-0.5 rounded font-black" style={{ background: '#C9A84C22', color: '#E8C84A', border: '1px solid #C9A84C44' }}>{coach.preferredFormation}</span>
            {formation?.id === coach.preferredFormation
              ? <span className="font-bold inline-flex items-center gap-1" style={{ color: '#22C55E' }}>✓ em uso · <span style={{ color: '#22C55E' }}>+{PREFERRED_FORMATION_CHEM_BONUS} química</span></span>
              : <span style={{ color: '#8A8A9A' }}>jogue nela pra <b style={{ color: '#22C55E' }}>+{PREFERRED_FORMATION_CHEM_BONUS} química</b> do time</span>}
          </div>
        )}
      </div>
    </div>
  );
}
