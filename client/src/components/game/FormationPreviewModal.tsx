import { Info } from 'lucide-react';
import type { Formation } from '../../lib/gameData';
import { IconButton } from '../../design-system';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import FormationField from './FormationField';

interface FormationInfoButtonProps {
  formationName: string;
  onClick: () => void;
}

export function FormationInfoButton({ formationName, onClick }: FormationInfoButtonProps) {
  return (
    <IconButton
      label={`Ver posições da formação ${formationName}`}
      title={`Ver posições da formação ${formationName}`}
      onClick={onClick}
      className="absolute right-2 top-2 z-10 size-8 rounded-full border-[var(--ui-line-strong)] bg-[var(--ui-surface-2)] p-0 text-[var(--ui-text-soft)] shadow-sm hover:border-[var(--ui-brand)] hover:bg-[var(--ui-surface-3)] hover:text-[var(--ui-brand-strong)]"
    >
      <Info size={16} aria-hidden="true" />
    </IconButton>
  );
}

interface FormationPreviewModalProps {
  formation: Formation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FormationPreviewModal({ formation, open, onOpenChange }: FormationPreviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        disableAnimation
        overlayClassName="bg-black/85"
        closeButtonLabel="Fechar visualização da formação"
        closeButtonClassName="right-3 top-3 flex size-10 items-center justify-center rounded-xl bg-[var(--ui-surface-2)] p-0 text-[var(--ui-text)] opacity-100 shadow-md hover:bg-[var(--ui-surface-3)] [&_svg]:size-5"
        className="max-h-[min(92dvh,860px)] max-w-2xl overflow-y-auto border-[var(--ui-line)] bg-[var(--ui-bg-raised)] p-4 text-[var(--ui-text)] shadow-2xl sm:p-6"
      >
        {formation ? (
          <>
            <DialogHeader className="pr-10 text-left">
              <DialogTitle className="font-display text-2xl tracking-wide text-[var(--ui-brand-strong)] sm:text-3xl">
                {formation.name}
              </DialogTitle>
            </DialogHeader>

            <div className="mx-auto w-full max-w-[420px]">
              <FormationField formation={formation} players={[]} showPlayerCards />
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
