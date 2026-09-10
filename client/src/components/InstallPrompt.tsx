// UCL Immortals — "install this app" prompt (PWA).
// Shows a bottom sheet ONLY on mobile, only when the app isn't already installed and the user
// hasn't dismissed it before. Android/Chrome get a real "Instalar" button (via beforeinstallprompt);
// iOS Safari (which has no such API) gets the manual "Adicionar à Tela de Início" instructions.
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../design-system';

const DISMISS_KEY = 'ucl-pwa-install-dismissed-v1';
const ICON = '/icons/icon-192.png';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BIPEvent = any; // BeforeInstallPromptEvent is non-standard / untyped

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (navigator as any).standalone === true;

const isIOS = () =>
  /iPhone|iPad|iPod/i.test(navigator.userAgent) &&
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  !(window as any).MSStream;

const isMobile = () =>
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  (window.matchMedia('(max-width: 820px)').matches && 'ontouchstart' in window);

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    // Don't nag: skip if already installed, previously dismissed, or not on a phone.
    if (isStandalone() || localStorage.getItem(DISMISS_KEY) || !isMobile()) return;

    const onBIP = (e: Event) => {
      e.preventDefault();        // stop Chrome's mini-infobar; we show our own
      setDeferred(e as BIPEvent);
      window.setTimeout(() => setShow(true), 2500); // let the player see the game first
    };
    window.addEventListener('beforeinstallprompt', onBIP);

    // iOS has no beforeinstallprompt → show manual "add to home screen" steps instead.
    let iosTimer: number | undefined;
    if (isIOS()) {
      iosTimer = window.setTimeout(() => { setIosHint(true); setShow(true); }, 2500);
    }

    const onInstalled = () => { setShow(false); localStorage.setItem(DISMISS_KEY, '1'); };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  const dismiss = () => { setShow(false); localStorage.setItem(DISMISS_KEY, '1'); };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch { /* ignore */ }
    setDeferred(null);
    setShow(false);
    localStorage.setItem(DISMISS_KEY, '1');
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="ui-modal-backdrop z-[100] items-end"
          onClick={dismiss}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="ui-modal m-3 max-w-md p-4"
          >
            <div className="ui-modal__header -mx-4 -mt-4 mb-4 flex items-center gap-3">
              <img src={ICON} alt="UCL Immortals" className="w-14 h-14 rounded-xl flex-shrink-0"
                style={{ border: '1px solid #C9A84C44' }} referrerPolicy="no-referrer" />
              <div className="min-w-0 flex-1">
                <div className="ui-modal__title text-lg">
                  Instalar UCL Immortals
                </div>
                <div className="mt-1 text-xs leading-snug text-[var(--ui-text-muted)]">
                  Jogue em tela cheia, com ícone na tela inicial — como um app.
                </div>
              </div>
              <button onClick={dismiss} aria-label="Fechar" className="ui-icon-btn flex-shrink-0">✕</button>
            </div>

            {iosHint ? (
              <div className="ui-panel ui-panel--inset mt-3 px-3 py-2.5 text-sm leading-relaxed text-[var(--ui-text-soft)]">
                No Safari: toque em <b style={{ color: '#fff' }}>Compartilhar</b> <span aria-hidden>⬆️</span> e depois em
                <b style={{ color: '#fff' }}> "Adicionar à Tela de Início"</b> <span aria-hidden>➕</span>.
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <Button intent="ghost" className="flex-1" onClick={dismiss}>
                  AGORA NÃO
                </Button>
                <Button intent="primary" size="large" className="flex-1" onClick={install}>
                  INSTALAR
                </Button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
