// UCL Immortals — the game's credit coin: the Estribado artwork's coins.

import { Fragment, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import TraitIcon from './TraitIcon';

export default function CoinIcon({ size = 16, className }: { size?: number; className?: string }) {
  return <TraitIcon trait="estribado" fallback="💰" size={size} className={cn('mr-[0.25em] align-[-0.2em]', className)} />;
}

/** Renders a plain message, swapping every 💰 for the coin icon. */
export function withCoins(text: string, size?: number): ReactNode {
  const parts = text.split('💰');
  return parts.map((part, index) => (
    <Fragment key={index}>{index > 0 && <CoinIcon size={size} />}{index > 0 ? part.replace(/^ /, '') : part}</Fragment>
  ));
}
