// UCL Immortals — the display name drawn with the account's name style (an
// event reward): a game-like font plus its colour and effect. The font is
// fetched only when a style is actually on screen.

import { useEffect } from 'react';
import { NAME_STYLE_BY_KEY } from '@shared/game/nameStyles';
import { cn } from '../../lib/utils';
import './styledName.css';

const loadedFonts = new Set<string>();

function loadFont(googleFamily: string) {
  if (loadedFonts.has(googleFamily) || typeof document === 'undefined') return;
  loadedFonts.add(googleFamily);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=' + googleFamily + '&display=swap';
  document.head.appendChild(link);
}

/**
 * size "lg" is the full effect (profile header, previews); size "sm" keeps the
 * font and colour but drops animations and heavy glows, so the name stays
 * legible in rankings and lists.
 */
export default function StyledName({ name, styleKey, size = 'lg', className }: {
  name: string;
  styleKey?: string | null;
  size?: 'lg' | 'sm';
  className?: string;
}) {
  const style = styleKey ? NAME_STYLE_BY_KEY.get(styleKey) : undefined;
  useEffect(() => { if (style) loadFont(style.googleFamily); }, [style]);
  if (!style) return <span className={className}>{name}</span>;
  return (
    <span className={cn('styled-name', 'styled-name--' + style.key, size === 'sm' && 'styled-name--sm', className)} style={{ fontFamily: style.font }}>
      {/* Gradient fills live on the inner span and glows on the outer one:
          Chrome would otherwise draw the drop-shadow of the whole box. */}
      <span className="styled-name__text">{name}</span>
    </span>
  );
}
