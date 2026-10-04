// UCL Immortals — play style icon (the 47 card traits in shared/game/traits).
// Line icons instead of emojis, so the list reads as one consistent set.

import {
  Anchor, ArrowUpDown, ArrowUpFromLine, Axe, BatteryFull, BrickWall, Cat, ChevronsUp, CircleArrowUp, CircleDot,
  Crosshair, Dumbbell, Expand, Eye, FastForward, Flag, Flame, Footprints, Gauge, Goal, Grab, Hand, LocateFixed,
  Lock, LogIn, Medal, Mountain, MoveHorizontal, Music, PersonStanding, Puzzle, Rocket, Route, Scale, Send,
  ShieldCheck, ShieldHalf, Snowflake, Sparkles, Spline, Star, Target, Timer, Undo2, WandSparkles, Wind, Zap,
  type LucideIcon,
} from 'lucide-react';

const PLAYSTYLE_ICONS: Record<string, LucideIcon> = {
  'Velocista': Wind,
  'Sobreposição': Route,
  'Ponta de Lança': Crosshair,
  'Invasor de Área': LogIn,
  'Chegada pelo Meio': ArrowUpFromLine,
  'Criador de Espaço': Expand,
  'Finalizador': Goal,
  'Finalização Precisa': Target,
  'Chute de Longe': Rocket,
  'Canhota Mágica': Footprints,
  'Frio na Final': Snowflake,
  'Especialista em Decisões': Scale,
  'Dribblador Nato': Sparkles,
  'Dribblador Técnico': WandSparkles,
  'Dribblador Veloz': Zap,
  'Maestro do Passe': Music,
  'Metrônomo': Timer,
  'Armador': Puzzle,
  'Passe Preciso': Send,
  'Passe de Calcanhar': Undo2,
  'Visão de Jogo': Eye,
  'Cobrador de Falta': Spline,
  'Bola Parada': Flag,
  'Cobrador de Pênaltis': CircleDot,
  'Cabeceador': CircleArrowUp,
  'Cabeceador Implacável': ChevronsUp,
  'Pivô': Anchor,
  'Pivô Implacável': Mountain,
  'Força Bruta': Dumbbell,
  'Motorzinho': BatteryFull,
  'Box-to-Box': ArrowUpDown,
  'Muralha': BrickWall,
  'Zagueiro Imponente': ShieldHalf,
  'Marcador Implacável': Lock,
  'Marcação Pesada': Axe,
  'Pressão Implacável': Flame,
  'Interceptador': Hand,
  'Posicionamento': LocateFixed,
  'Pressionador': Gauge,
  'Liderança': Medal,
  'Líder da Defesa': ShieldCheck,
  'Reflexo Felino': Cat,
  'Elasticidade': MoveHorizontal,
  'Pegador de Pênalti': Grab,
  'Goleiro Líbero': PersonStanding,
  'Saída Rápida': FastForward,
  'Talento Natural': Star,
};

export default function PlaystyleIcon({ trait, fallback, size = 14, color = 'currentColor', className }: {
  trait: string;
  /** Shown when the trait has no mapped icon (its emoji). */
  fallback?: string;
  size?: number;
  color?: string;
  className?: string;
}) {
  const Icon = PLAYSTYLE_ICONS[trait];
  if (!Icon) return <span aria-hidden="true" className={className}>{fallback ?? '⭐'}</span>;
  return <Icon size={size} strokeWidth={2.25} color={color} aria-hidden="true" className={className} />;
}
