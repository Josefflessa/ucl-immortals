import type { HTMLAttributes, ReactNode } from 'react';
import * as React from 'react';
import { cn } from '../lib/utils';
import { Badge, Button, Panel, PanelBody, PanelHeader, PanelTitle, SectionHeader, type UiIntent } from './primitives';
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
  description: string;
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
