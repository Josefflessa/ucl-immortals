import CoinIcon from './CoinIcon';

interface CreditsWalletProps {
  points: number;
}

export default function CreditsWallet({ points }: CreditsWalletProps) {
  return (
    <div className="credits-wallet" aria-label={'Créditos disponíveis: ' + points} aria-live="polite">
      <CoinIcon size={18} className="mr-0" />
      <span className="credits-wallet__label">CRÉDITOS</span>
      <strong className="credits-wallet__value">{points}</strong>
    </div>
  );
}
