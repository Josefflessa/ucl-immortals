import { Info } from 'lucide-react';
import type { Formation } from '../../lib/gameData';
import { GameModal, IconButton } from '../../design-system';
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
    <GameModal
      open={open}
      onOpenChange={onOpenChange}
      size="wide"
      closeLabel="Fechar visualização da formação"
      title={formation ? formation.name : undefined}
    >
      {formation ? (
        <div className="mx-auto w-full max-w-[420px]">
          <FormationField formation={formation} players={[]} showPlayerCards />
        </div>
      ) : null}
    </GameModal>
  );
}
