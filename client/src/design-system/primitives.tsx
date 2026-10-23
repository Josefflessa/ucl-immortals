import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import * as React from 'react';
import { cn } from '../lib/utils';
import { useSoundOnMount } from '../audio/uiSound';

type UiTone = 'default' | 'accent' | 'inset' | 'live';
export type UiIntent = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'info';

interface AppShellProps extends HTMLAttributes<HTMLDivElement> {
  backgroundImage?: string;
  immersive?: boolean;
}

export function AppShell({ className, backgroundImage, immersive = false, children, style, ...props }: AppShellProps) {
  return (
    <div
      className={cn('ui-app', immersive && 'ui-app--immersive', className)}
      style={{
        ...style,
        ...(backgroundImage
          ? {
              backgroundImage: `linear-gradient(180deg, rgba(8, 11, 20, 0.34), rgba(8, 11, 20, 0.96)), url(${backgroundImage})`,
              backgroundPosition: 'center',
              backgroundSize: 'cover',
            }
          : {}),
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function PageContainer({ className, narrow = false, wide = false, ...props }: HTMLAttributes<HTMLDivElement> & { narrow?: boolean; wide?: boolean }) {
  return <div className={cn('ui-page', narrow && 'ui-page--narrow', wide && 'ui-page--wide', className)} {...props} />;
}

export function FixedActionBar({
  children,
  narrow = false,
  contentClassName,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { narrow?: boolean; contentClassName?: string }) {
  return (
    <div
      {...props}
      className={cn('fixed inset-x-0 bottom-0 z-(--ui-z-action-bar) border-t border-[var(--ui-line-subtle)] bg-[var(--ui-bg)]/95 pt-3 backdrop-blur-md', className)}
      style={{ ...props.style, paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      <div className={cn('mx-auto flex w-full gap-3 px-[var(--ui-gutter)]', narrow ? 'max-w-(--ui-page-narrow)' : 'max-w-(--ui-content-max)', contentClassName)}>
        {children}
      </div>
    </div>
  );
}

export function TopBar({ className, logoUrl = '/icons/logo_ucl.png', title = 'UCL IMMORTALS', subtitle, playerName, center, right, ...props }: HTMLAttributes<HTMLDivElement> & { logoUrl?: string; title?: string; subtitle?: ReactNode; playerName?: string; center?: ReactNode; right?: ReactNode }) {
  return (
    <header className={cn('ui-topbar', className)} {...props}>
      <div className={cn('ui-shell ui-topbar__inner', playerName && right && 'ui-topbar__inner--with-context', center && 'ui-topbar__inner--with-center')}>
        <div className="ui-brand-lockup">
          <img src={logoUrl} alt="" aria-hidden="true" />
          <span className={cn('ui-brand-lockup__text', subtitle && 'ui-brand-lockup__text--stacked')}>
            <span className="ui-brand-lockup__title">{title}</span>
            {subtitle ? <span className="ui-brand-lockup__subtitle">{subtitle}</span> : null}
          </span>
        </div>
        {center ? <div className="ui-topbar__center">{center}</div> : null}
        {playerName ? <div className="ui-player-context">Time: <strong>{playerName}</strong></div> : null}
        {right ? <div className="ui-topbar__right">{right}</div> : null}
      </div>
    </header>
  );
}

/** Page title block. One `level="page"` (h1) per screen; `level="section"` (h2) for blocks inside a page. */
export function SectionHeader({ kicker, title, description, actions, level = 'page', className, ...props }: Omit<HTMLAttributes<HTMLDivElement>, 'title'> & { kicker?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode; level?: 'page' | 'section' }) {
  const Heading = level === 'page' ? 'h1' : 'h2';
  return (
    <div className={cn('ui-section-header', level === 'section' && 'ui-section-header--section', className)} {...props}>
      <div className="min-w-0">
        {kicker ? <div className="ui-kicker">{kicker}</div> : null}
        <Heading className={cn('ui-title', level === 'section' && 'ui-title--section')}>{title}</Heading>
        {description ? <p className="ui-subtitle">{description}</p> : null}
      </div>
      {actions ? <div className="ui-cluster">{actions}</div> : null}
    </div>
  );
}

export function Panel({ tone = 'default', density = 'comfortable', className, children, ...props }: HTMLAttributes<HTMLDivElement> & { tone?: UiTone; density?: 'comfortable' | 'compact' }) {
  return <section className={cn('ui-panel', density === 'compact' && 'ui-panel--compact', tone === 'accent' && 'ui-panel--accent', tone === 'inset' && 'ui-panel--inset', tone === 'live' && 'ui-panel--live', className)} {...props}>{children}</section>;
}

export function PanelHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ui-panel__header', className)} {...props}>{children}</div>;
}

export function PanelTitle({ className, children, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('ui-panel__title', className)} {...props}>{children}</span>;
}

export function PanelBody({ flush = false, className, children, ...props }: HTMLAttributes<HTMLDivElement> & { flush?: boolean }) {
  return <div className={cn('ui-panel__body', flush && 'ui-panel__body--flush', className)} {...props}>{children}</div>;
}

export function Button({ intent = 'secondary', size, block = false, loading = false, disabled, type, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { intent?: UiIntent; size?: 'small' | 'default' | 'large'; block?: boolean; loading?: boolean }) {
  return <button type={type ?? 'button'} aria-busy={loading || undefined} disabled={disabled || loading} className={cn('ui-btn', `ui-btn--${intent}`, size === 'large' && 'ui-btn--large', size === 'small' && 'ui-btn--small', block && 'ui-btn--block', loading && 'ui-btn--loading', className)} {...props}>{loading ? <span className="ui-btn__loader" aria-hidden="true" /> : null}{children}</button>;
}

export function IconButton({ label, size = 'default', className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: 'small' | 'default' | 'large' }) {
  return <button type="button" aria-label={label} title={props.title ?? label} className={cn('ui-icon-btn', size !== 'default' && `ui-icon-btn--${size}`, className)} {...props}>{children}</button>;
}

export const Input = React.forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn('ui-input', className)} {...props} />;
});

export function Progress({ value, max = 100, tone = 'brand', className, ...props }: HTMLAttributes<HTMLDivElement> & { value: number; max?: number; tone?: 'brand' | 'success' | 'warning' | 'danger' }) {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn('ui-progress', className)} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} {...props}>
      <div className={cn('ui-progress__fill', `ui-progress__fill--${tone}`)} style={{ width: `${percentage}%` }} />
    </div>
  );
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn('ui-skeleton', className)} {...props} />;
}

export function EmptyState({ title, description, action, icon, className, ...props }: Omit<HTMLAttributes<HTMLDivElement>, 'title'> & { title: ReactNode; description?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className={cn('ui-empty', className)} {...props}>
      {icon ? <div className="ui-empty__icon" aria-hidden="true">{icon}</div> : null}
      <strong className="ui-empty__title">{title}</strong>
      {description ? <p className="ui-empty__description">{description}</p> : null}
      {action ? <div className="ui-empty__action">{action}</div> : null}
    </div>
  );
}

export function ChoiceCard({ selected = false, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return <button type="button" aria-pressed={selected} data-selected={selected} className={cn('ui-choice', className)} {...props}>{children}</button>;
}

export function Badge({ tone = 'default', className, children, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: 'default' | 'brand' | 'info' | 'success' | 'warning' | 'danger' }) {
  return <span className={cn('ui-badge', tone !== 'default' && `ui-badge--${tone}`, className)} {...props}>{children}</span>;
}

export function StatusBanner({ tone = 'default', title, children, className, ...props }: HTMLAttributes<HTMLDivElement> & { tone?: 'default' | 'success' | 'warning' | 'danger' | 'live'; title?: string }) {
  // A banner that appears tells you what happened: a soft cue for the two kinds that matter.
  useSoundOnMount(tone === 'danger' ? 'error' : tone === 'success' ? 'success' : null);
  return <div className={cn('ui-status', tone !== 'default' && `ui-status--${tone}`, className)} {...props}>{title ? <strong>{title}</strong> : null}{children ? <span>{children}</span> : null}</div>;
}

export function Metric({ label, value, detail, tone = 'default', className, ...props }: HTMLAttributes<HTMLDivElement> & { label: string; value: ReactNode; detail?: ReactNode; tone?: 'default' | 'brand' | 'success' | 'danger' }) {
  return (
    <div className={cn('ui-panel ui-panel--inset ui-metric', tone !== 'default' && `ui-metric--${tone}`, className)} {...props}>
      <div className="ui-metric__label">{label}</div>
      <div className="ui-metric__value">{value}</div>
      {detail ? <div className="ui-metric__detail">{detail}</div> : null}
    </div>
  );
}

/** Form field: label + control + hint or error. The control is `children`; pass the same `id` to it as `htmlFor`. */
export function Field({ label, htmlFor, hint, error, className, children, ...props }: HTMLAttributes<HTMLDivElement> & { label: ReactNode; htmlFor?: string; hint?: ReactNode; error?: ReactNode }) {
  return (
    <div className={cn('ui-field', className)} {...props}>
      <label className="ui-field__label" htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <p className="ui-field__error" role="alert">{error}</p> : hint ? <p className="ui-field__hint">{hint}</p> : null}
    </div>
  );
}

/** The gold check that marks the chosen ChoiceCard. Place it in the card's top-right corner. */
export function ChoiceCheck({ className, color, size = 'default', style, ...props }: HTMLAttributes<HTMLSpanElement> & { color?: string; size?: 'small' | 'default' }) {
  return (
    <span aria-hidden="true" className={cn('ui-choice-check', size === 'small' && 'ui-choice-check--small', className)} style={color ? { ...style, background: color } : style} {...props}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
    </span>
  );
}

/** Filter pill (league, category). Several in a row; one or more can be `selected`. */
export function Chip({ selected = false, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return <button type="button" aria-pressed={selected} data-selected={selected} className={cn('ui-chip', className)} {...props}>{children}</button>;
}
