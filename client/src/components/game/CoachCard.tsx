import { Coach, Formation } from '@shared/game/gameData';
import { PREFERRED_FORMATION_CHEM_BONUS } from '@shared/game/gameEngine';
import { coachPrimeDefinition } from '../../lib/coachPrime';

interface CoachCardProps {
  coach: Coach;
  formation?: Formation;
  isPrime?: boolean;       // Fase 2 (Técnico Prime): selo PRIME + foto/moldura quando evoluído
  primePhotoUrl?: string;  // foto Prime do técnico
  bare?: boolean;          // sem container externo — pra compor no painel único
  showHeader?: boolean;    // permite que o modal pai seja o único título da seção
}

// Card do técnico — extraído do inline da SquadEditor pra ser reusado (MEU TIME + fim de campanha).
export default function CoachCard({ coach, formation, isPrime = false, primePhotoUrl, bare = false, showHeader = true }: CoachCardProps) {
  const photo = isPrime && primePhotoUrl ? primePhotoUrl : coach.photoUrl;
  const primeDefinition = isPrime ? coachPrimeDefinition(coach.id) : null;
  const abilityName = primeDefinition?.name ?? coach.specialAbilityName;
  const abilityDescription = primeDefinition?.prime ?? coach.specialAbility;
  return (
    <div className={bare ? '' : 'rounded-xl overflow-hidden'} style={bare ? undefined : { background: '#0F0F1A', border: `1px solid ${isPrime ? '#C9A84C55' : '#1A1A2A'}` }}>
      {showHeader && (
        <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--ui-surface-3)', background: '#0A0A12' }}>
          <span className="text-[12px] font-black tracking-widest" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>🎓 TÉCNICO</span>
          <span className="text-[11px] font-bold tracking-wider" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>COMANDO DO TIME</span>
        </div>
      )}
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
            <div className="text-lg font-black leading-none" style={{ fontFamily: 'var(--font-display), sans-serif', color: '#FFF' }}>{coach.name}</div>
            {isPrime && (
              <span className="text-[11px] font-black px-1.5 py-0.5 rounded leading-none" style={{ background: 'linear-gradient(90deg, var(--ui-brand), var(--ui-brand-strong))', color: '#0A0A12', fontFamily: 'var(--font-game), sans-serif', letterSpacing: '0.1em' }}>PRIME</span>
            )}
          </div>
          <div className="text-[13px] font-bold mt-0.5" style={{ color: 'var(--ui-brand)', fontFamily: 'var(--font-game), sans-serif' }}>{coach.philosophy}</div>
          <div className="text-[13px] mt-1 leading-snug" style={{ color: 'var(--ui-text-muted)', fontFamily: 'var(--font-game), sans-serif' }}>{coach.description}</div>
        </div>
      </div>
      <div className="px-4 pb-4 space-y-2">
        <div className="rounded-lg px-3 py-2" style={{ background: '#0A0A12', border: '1px solid var(--ui-surface-3)' }}>
          <div className="text-[11px] font-black tracking-widest mb-1" style={{ color: 'var(--ui-brand-strong)', fontFamily: 'var(--font-game), sans-serif' }}>⚡ EFEITO NO ELENCO</div>
          <div className="text-[13px] leading-snug" style={{ color: '#C9C9D5', fontFamily: 'var(--font-game), sans-serif' }}>{coach.effect}</div>
        </div>
        <div className="rounded-lg px-3 py-2" style={{ background: '#0A0A12', border: '1px solid #2A2A4A' }}>
          <div className="text-[11px] font-black tracking-widest mb-1" style={{ color: isPrime ? 'var(--ui-brand-strong)' : '#A78BFA', fontFamily: 'var(--font-game), sans-serif' }}>✨ HABILIDADE{isPrime ? ' PRIME' : ''}: {abilityName?.toUpperCase()}</div>
          <div className="text-[13px] leading-snug" style={{ color: '#C9C9D5', fontFamily: 'var(--font-game), sans-serif' }}>{abilityDescription}</div>
        </div>
        {coach.preferredFormation && (
          <div className="flex items-center gap-2 text-[12px] pt-0.5 flex-wrap" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
            <span style={{ color: 'var(--ui-text-faint)' }}>Formação preferida:</span>
            <span className="px-2 py-0.5 rounded font-black" style={{ background: '#C9A84C22', color: 'var(--ui-brand-strong)', border: '1px solid #C9A84C44' }}>{coach.preferredFormation}</span>
            {formation?.id === coach.preferredFormation
              ? <span className="font-bold inline-flex items-center gap-1" style={{ color: 'var(--ui-success)' }}>✓ em uso · <span style={{ color: 'var(--ui-success)' }}>+{PREFERRED_FORMATION_CHEM_BONUS} química</span></span>
              : <span style={{ color: '#8A8A9A' }}>jogue nela pra <b style={{ color: 'var(--ui-success)' }}>+{PREFERRED_FORMATION_CHEM_BONUS} química</b> do time</span>}
          </div>
        )}
      </div>
    </div>
  );
}
