import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import * as React from 'react';
import { cn } from '../lib/utils';

export type UiTone = 'default' | 'accent' | 'inset' | 'live';
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

export function TopBar({ className, logoUrl = '/icons/logo_ucl.png', title = 'UCL IMMORTALS', playerName, right, ...props }: HTMLAttributes<HTMLDivElement> & { logoUrl?: string; title?: string; playerName?: string; right?: ReactNode }) {
  return (
    <header className={cn('ui-topbar', className)} {...props}>
      <div className="ui-shell ui-topbar__inner">
        <div className="ui-brand-lockup">
          <img src={logoUrl} alt="" aria-hidden="true" />
          <span>{title}</span>
        </div>
        {playerName ? <div className="ui-player-context">Time: <strong>{playerName}</strong></div> : null}
        {right}
      </div>
    </header>
  );
}

export interface FlowStep {
  id?: string;
  label: string;
  state?: 'done' | 'current' | 'upcoming';
  disabled?: boolean;
}

export function FlowHeader({ steps, onStepClick, className, ...props }: HTMLAttributes<HTMLDivElement> & { steps: FlowStep[]; onStepClick?: (step: FlowStep, index: number) => void }) {
  const currentIndex = Math.max(0, steps.findIndex(step => step.state === 'current'));
  const currentStep = steps[currentIndex] ?? steps[0];

  return (
    <div className={cn('ui-flow-header', className)} {...props}>
      <div className="ui-flow-summary" aria-live="polite">
        <span>ETAPA {String(currentIndex + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}</span>
        <strong>{currentStep?.label}</strong>
      </div>
      <div className="ui-stepper" aria-label="Progresso da montagem do time">
        {steps.map((step, index) => {
          const className = cn('ui-step', step.state === 'done' && 'ui-step--done', step.state === 'current' && 'ui-step--current');
          const content = <><span className="ui-step__number">{String(index + 1).padStart(2, '0')}</span><span className="ui-step__label">{step.label}</span></>;
          if (!onStepClick) return <span key={step.id ?? step.label} className={className}>{content}</span>;
          return (
            <button
              key={step.id ?? step.label}
              type="button"
              className={className}
              disabled={step.disabled}
              aria-current={step.state === 'current' ? 'step' : undefined}
              onClick={() => onStepClick(step, index)}
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SectionHeader({ kicker, title, description, actions, className, ...props }: HTMLAttributes<HTMLDivElement> & { kicker?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className={cn('ui-section-header', className)} {...props}>
      <div>
        {kicker ? <div className="ui-kicker">{kicker}</div> : null}
        <h1 className="ui-title">{title}</h1>
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

export function Button({ intent = 'secondary', size, loading = false, disabled, type, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { intent?: UiIntent; size?: 'default' | 'large'; loading?: boolean }) {
  return <button type={type ?? 'button'} aria-busy={loading || undefined} disabled={disabled || loading} className={cn('ui-btn', `ui-btn--${intent}`, size === 'large' && 'ui-btn--large', loading && 'ui-btn--loading', className)} {...props}>{loading ? <span className="ui-btn__loader" aria-hidden="true" /> : null}{children}</button>;
}

export function IconButton({ label, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" aria-label={label} className={cn('ui-icon-btn', className)} {...props}>{children}</button>;
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

export function Divider({ className, ...props }: HTMLAttributes<HTMLHRElement>) {
  return <hr className={cn('ui-divider', className)} {...props} />;
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn('ui-skeleton', className)} {...props} />;
}

export function EmptyState({ title, description, action, className, ...props }: HTMLAttributes<HTMLDivElement> & { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className={cn('ui-empty', className)} {...props}>
      <strong className="ui-empty__title">{title}</strong>
      {description ? <p className="ui-empty__description">{description}</p> : null}
      {action ? <div className="ui-empty__action">{action}</div> : null}
    </div>
  );
}

export function ChoiceCard({ selected = false, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return <button type="button" aria-pressed={selected} data-selected={selected} className={cn('ui-choice', className)} {...props}>{children}</button>;
}

export function Badge({ tone = 'default', className, children, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: 'default' | 'brand' | 'success' | 'warning' | 'danger' }) {
  return <span className={cn('ui-badge', tone !== 'default' && `ui-badge--${tone}`, className)} {...props}>{children}</span>;
}

export function StatusBanner({ tone = 'default', title, children, className, ...props }: HTMLAttributes<HTMLDivElement> & { tone?: 'default' | 'success' | 'warning' | 'danger' | 'live'; title?: string }) {
  return <div className={cn('ui-status', tone !== 'default' && `ui-status--${tone}`, className)} {...props}>{title ? <strong>{title}</strong> : null}{children ? <span>{children}</span> : null}</div>;
}

export function Metric({ label, value, detail, tone = 'default', className, ...props }: HTMLAttributes<HTMLDivElement> & { label: string; value: ReactNode; detail?: ReactNode; tone?: 'default' | 'brand' | 'success' | 'danger' }) {
  return (
    <div className={cn('ui-panel ui-panel--inset p-3', className)} {...props}>
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ui-text-faint)]">{label}</div>
      <div className={cn('mt-1 font-display text-3xl leading-none text-[var(--ui-text)]', tone === 'brand' && 'text-[var(--ui-brand-strong)]', tone === 'success' && 'text-[var(--ui-success)]', tone === 'danger' && 'text-[var(--ui-danger)]')}>{value}</div>
      {detail ? <div className="mt-1 text-xs text-[var(--ui-text-muted)]">{detail}</div> : null}
    </div>
  );
}
