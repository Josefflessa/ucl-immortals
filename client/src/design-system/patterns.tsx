import type { HTMLAttributes, ReactNode } from 'react';
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';
import { Badge, Button, IconButton, Panel, PanelBody, PanelHeader, PanelTitle, SectionHeader, type UiIntent } from './primitives';
import { Tabs as PrimitiveTabs, TabsContent as PrimitiveTabsContent, TabsList as PrimitiveTabsList, TabsTrigger as PrimitiveTabsTrigger } from '../components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

export function Tabs(props: React.ComponentProps<typeof PrimitiveTabs>) {
  return <PrimitiveTabs {...props} className={cn('ui-tabs-root', props.className)} />;
}

export function TabList(props: React.ComponentProps<typeof PrimitiveTabsList>) {
  return <PrimitiveTabsList {...props} className={cn('ui-tabs', props.className)} />;
}

export function Tab(props: React.ComponentProps<typeof PrimitiveTabsTrigger>) {
  return <PrimitiveTabsTrigger {...props} className={cn('ui-tab', props.className)} />;
}

export function TabPanel(props: React.ComponentProps<typeof PrimitiveTabsContent>) {
  return <PrimitiveTabsContent {...props} className={cn('ui-tab-panel', props.className)} />;
}

export function CompetitionHeader({ kicker, title, description, status, actions, className, ...props }: HTMLAttributes<HTMLDivElement> & { kicker?: string; title: string; description?: string; status?: ReactNode; actions?: ReactNode }) {
  return (
    <div className={cn('ui-competition-header', className)} {...props}>
      <SectionHeader kicker={kicker} title={title} description={description} actions={actions} />
      {status ? <div className="ui-competition-header__status">{status}</div> : null}
    </div>
  );
}

export interface MatchdayCardProps extends HTMLAttributes<HTMLDivElement> {
  eyebrow?: string;
  home: string;
  away: string;
  homeMeta?: ReactNode;
  awayMeta?: ReactNode;
  status?: ReactNode;
  actionLabel?: string;
  actionIntent?: UiIntent;
  onAction?: () => void;
  disabled?: boolean;
}

export function MatchdayCard({ eyebrow = 'PRÓXIMA PARTIDA', home, away, homeMeta, awayMeta, status, actionLabel, actionIntent = 'primary', onAction, disabled, className, ...props }: MatchdayCardProps) {
  return (
    <Panel className={cn('ui-matchday-card', className)} {...props}>
      <PanelHeader>
        <PanelTitle>{eyebrow}</PanelTitle>
        {status ? <Badge tone="brand">{status}</Badge> : null}
      </PanelHeader>
      <PanelBody>
        <div className="ui-matchday-card__teams">
          <div className="ui-matchday-card__team ui-matchday-card__team--home">
            <strong>{home}</strong>
            {homeMeta ? <span>{homeMeta}</span> : null}
          </div>
          <span className="ui-matchday-card__versus">VS</span>
          <div className="ui-matchday-card__team ui-matchday-card__team--away">
            <strong>{away}</strong>
            {awayMeta ? <span>{awayMeta}</span> : null}
          </div>
        </div>
        {onAction && actionLabel ? <Button intent={actionIntent} className="w-full" disabled={disabled} onClick={onAction}>{actionLabel}</Button> : null}
      </PanelBody>
    </Panel>
  );
}

export interface StatItem { label: string; value: ReactNode; detail?: ReactNode; tone?: 'default' | 'brand' | 'success' | 'danger'; }

export function StatGrid({ items, className, ...props }: HTMLAttributes<HTMLDivElement> & { items: StatItem[] }) {
  return (
    <div className={cn('ui-stat-grid', className)} {...props}>
      {items.map(item => (
        <div key={item.label} className="ui-stat-grid__item">
          <span>{item.label}</span>
          <strong className={item.tone ? `ui-stat-grid__value--${item.tone}` : undefined}>{item.value}</strong>
          {item.detail ? <small>{item.detail}</small> : null}
        </div>
      ))}
    </div>
  );
}

export interface TimelineItem { id: string; time?: ReactNode; icon?: ReactNode; title: ReactNode; description?: ReactNode; tone?: 'neutral' | 'brand' | 'success' | 'danger' | 'warning'; }

export function Timeline({ items, empty, className, ...props }: HTMLAttributes<HTMLOListElement> & { items: TimelineItem[]; empty?: ReactNode }) {
  return (
    <ol className={cn('ui-timeline', className)} {...props}>
      {items.length === 0 && empty ? <li className="ui-timeline__empty">{empty}</li> : null}
      {items.map(item => (
        <li key={item.id} className={cn('ui-timeline__item', item.tone && `ui-timeline__item--${item.tone}`)}>
          {item.time ? <time>{item.time}</time> : null}
          {item.icon ? <span className="ui-timeline__icon" aria-hidden="true">{item.icon}</span> : null}
          <div className="ui-timeline__content"><strong>{item.title}</strong>{item.description ? <span>{item.description}</span> : null}</div>
        </li>
      ))}
    </ol>
  );
}

export function ArtifactPreview({ label, children, className, ...props }: HTMLAttributes<HTMLDivElement> & { label?: string }) {
  return <div className={cn('ui-artifact-preview', className)} {...props}>{label ? <div className="ui-artifact-preview__label">{label}</div> : null}{children}</div>;
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  intent?: UiIntent;
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', onConfirm, intent = 'danger' }: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="ui-modal p-0">
        <AlertDialogHeader className="ui-modal__header text-left">
          <AlertDialogTitle className="ui-modal__title">{title}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription className="ui-modal__body text-sm leading-relaxed text-[var(--ui-text-muted)]">
          {description}
        </AlertDialogDescription>
        <AlertDialogFooter className="ui-modal__footer">
          <AlertDialogCancel className="ui-btn ui-btn--ghost">{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction className={cn('ui-btn', `ui-btn--${intent}`)} onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export interface GameModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rendered in .ui-modal__title. Omit for a header-less modal (rare — prefer a title). */
  title?: ReactNode;
  /** Small text under the title, inside the same header block. */
  subtitle?: ReactNode;
  /** Extra header content before the close button (e.g. a tab counter). */
  headerExtra?: ReactNode;
  /** .ui-modal__footer content — action buttons. */
  footer?: ReactNode;
  /** Content pinned between the header and the scrollable body — e.g. a row
   * of section tabs that should stay visible while the body scrolls. */
  stickyTop?: ReactNode;
  size?: 'default' | 'wide';
  /** A modal opened on top of another already-open modal (e.g. a purchase
   * confirmation over the shop's item modal). Only set this where that is
   * actually true — most modals are the base layer. */
  stacked?: boolean;
  /**
   * false = the decision is mandatory: no X, no Esc, no click-outside.
   * Only the explicit action button(s) in `footer`/children close it
   * (recruitment pick, penalty shootout, invalid-lineup acknowledgement).
   */
  dismissible?: boolean;
  /** aria-label of the close button. Default 'Fechar'. */
  closeLabel?: string;
  bodyClassName?: string;
  bodyStyle?: React.CSSProperties;
  className?: string;
  children?: ReactNode;
}

/**
 * The one modal shell for every game overlay. Built on Radix Dialog (real
 * Esc + focus trap) but styled with the game's existing .ui-modal* classes —
 * no new colors, fonts or chrome, just one consistent structure and one
 * consistent close button (40px, top-right, always labeled).
 */
export function GameModal({
  open, onOpenChange, title, subtitle, headerExtra, footer, stickyTop,
  size = 'default', stacked = false, dismissible = true, closeLabel = 'Fechar',
  bodyClassName, bodyStyle, className, children,
}: GameModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={next => { if (dismissible || next) onOpenChange(next); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn('ui-modal-backdrop', stacked ? 'z-[60]' : 'z-50')}
          onClick={event => { if (!dismissible) event.preventDefault(); }}
        >
          <DialogPrimitive.Content
            className={cn('ui-modal', size === 'wide' && 'ui-modal--wide', 'flex flex-col', className)}
            aria-describedby={undefined}
            onPointerDownOutside={event => { if (!dismissible) event.preventDefault(); }}
            onEscapeKeyDown={event => { if (!dismissible) event.preventDefault(); }}
            onOpenAutoFocus={dismissible ? undefined : event => event.preventDefault()}
          >
            {!title ? <DialogPrimitive.Title className="sr-only">Janela</DialogPrimitive.Title> : null}
            {(title || headerExtra || dismissible) && (
              <div className="ui-modal__header flex-shrink-0">
                <div className="min-w-0">
                  {title ? <DialogPrimitive.Title className="ui-modal__title">{title}</DialogPrimitive.Title> : null}
                  {subtitle ? <p className="mt-0.5 text-xs text-[var(--ui-text-muted)]">{subtitle}</p> : null}
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {headerExtra}
                  {dismissible ? (
                    <DialogPrimitive.Close asChild>
                      <IconButton label={closeLabel}>
                        <X size={20} strokeWidth={2} aria-hidden="true" />
                      </IconButton>
                    </DialogPrimitive.Close>
                  ) : null}
                </div>
              </div>
            )}
            {stickyTop ? <div className="flex-shrink-0">{stickyTop}</div> : null}
            <div className={cn('ui-modal__body min-h-0 flex-1', bodyClassName)} style={bodyStyle}>
              {children}
            </div>
            {footer ? <div className="ui-modal__footer flex-shrink-0">{footer}</div> : null}
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
