import { Coach, Formation } from '@shared/game/gameData';
import { PREFERRED_FORMATION_CHEM_BONUS } from '@shared/game/gameEngine';
import { coachBaseDescription, coachPrimeDefinition } from '../../lib/coachPrime';
import { Check, GraduationCap, Sparkles, Zap } from 'lucide-react';
import { INLINE_ICON } from './inlineIcon';

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
  const primeDefinition = coachPrimeDefinition(coach);
  const baseDescription = coachBaseDescription(coach, isPrime);
  const abilityName = primeDefinition.name;
  const abilityDescription = isPrime ? primeDefinition.prime : primeDefinition.normal;
  return (
    <div className={bare ? '' : 'rounded-xl overflow-hidden'} style={bare ? undefined : { background: '#0F0F1A', border: `1px solid ${isPrime ? '#C9A84C55' : '#1A1A2A'}` }}>
      {showHeader && (
        <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--ui-surface-3)', background: '#0A0A12' }}>
          <span className="text-caption font-black tracking-wide-caps" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}><GraduationCap {...INLINE_ICON} />TREINADOR</span>
          <span className="text-caption font-bold tracking-wide-caps" style={{ color: 'var(--ui-text-faint)', fontFamily: 'var(--font-game), sans-serif' }}>COMANDO DO TIME</span>
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
          <div className="text-sm font-bold mt-0.5" style={{ color: 'var(--ui-brand)', fontFamily: 'var(--font-game), sans-serif' }}>{coach.philosophy}</div>
          <div className="text-sm mt-1 leading-snug" style={{ color: 'var(--ui-text-muted)', fontFamily: 'var(--font-game), sans-serif' }}>{coach.description}</div>
        </div>
      </div>
      <div className="px-4 pb-4 space-y-2">
        <div className="rounded-lg px-3 py-2" style={{ background: '#0A0A12', border: '1px solid var(--ui-surface-3)' }}>
          <div className="text-caption font-black tracking-wide-caps mb-1" style={{ color: 'var(--ui-brand-strong)', fontFamily: 'var(--font-game), sans-serif' }}><Zap {...INLINE_ICON} fill="currentColor" />BÔNUS BASE</div>
          <div className="space-y-1 text-sm leading-snug" style={{ color: '#C9C9D5', fontFamily: 'var(--font-game), sans-serif' }}>
            {baseDescription.map((line, index) => <p key={index}>{line}</p>)}
          </div>
        </div>
        <div className="rounded-lg px-3 py-2" style={{ background: '#0A0A12', border: '1px solid #2A2A4A' }}>
          <div className="text-caption font-black tracking-wide-caps mb-1" style={{ color: isPrime ? 'var(--ui-brand-strong)' : '#A78BFA', fontFamily: 'var(--font-game), sans-serif' }}><Sparkles {...INLINE_ICON} />HABILIDADE{isPrime ? ' PRIME' : ''}: {abilityName?.toUpperCase()}</div>
          <div className="text-sm leading-snug" style={{ color: '#C9C9D5', fontFamily: 'var(--font-game), sans-serif' }}>{abilityDescription}</div>
        </div>
        {coach.preferredFormation && (
          <div className="flex items-center gap-2 text-[13px] pt-0.5 flex-wrap" style={{ fontFamily: 'var(--font-game), sans-serif' }}>
            <span style={{ color: 'var(--ui-text-faint)' }}>Formação preferida:</span>
            <span className="px-2 py-0.5 rounded font-black" style={{ background: '#C9A84C22', color: 'var(--ui-brand-strong)', border: '1px solid #C9A84C44' }}>{coach.preferredFormation}</span>
            {formation?.id === coach.preferredFormation
              ? <span className="font-bold inline-flex items-center gap-1" style={{ color: 'var(--ui-success)' }}><Check size="1em" strokeWidth={3} aria-hidden="true" />em uso · <span style={{ color: 'var(--ui-success)' }}>+{PREFERRED_FORMATION_CHEM_BONUS} química geral</span></span>
              : <span style={{ color: '#8A8A9A' }}>Use essa formação para dar <b style={{ color: 'var(--ui-success)' }}>+{PREFERRED_FORMATION_CHEM_BONUS} de química geral</b> ao time.</span>}
          </div>
        )}
      </div>
    </div>
  );
}
