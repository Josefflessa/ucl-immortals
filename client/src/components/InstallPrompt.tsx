// UCL Immortals — "install this app" prompt (PWA).
// Shows a bottom sheet ONLY on mobile, only when the app isn't already installed and the user
// hasn't dismissed it before. Android/Chrome get a real "Instalar" button (via beforeinstallprompt);
// iOS Safari (which has no such API) gets the manual "Adicionar à Tela de Início" instructions.
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
          className="fixed inset-0 z-[100] flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
          onClick={dismiss}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md m-3 rounded-2xl p-4"
            style={{ background: '#0b0b14', border: '1px solid #C9A84C55', boxShadow: '0 0 40px rgba(0,0,0,0.7)' }}
          >
            <div className="flex items-center gap-3">
              <img src={ICON} alt="UCL Immortals" className="w-14 h-14 rounded-xl flex-shrink-0"
                style={{ border: '1px solid #C9A84C44' }} referrerPolicy="no-referrer" />
              <div className="min-w-0 flex-1">
                <div className="text-lg font-black tracking-wide leading-none"
                  style={{ fontFamily: 'Bebas Neue, sans-serif', color: '#C9A84C' }}>
                  INSTALAR UCL IMMORTALS
                </div>
                <div className="text-[12px] mt-1 leading-snug" style={{ color: '#9AA8C8', fontFamily: 'Rajdhani, sans-serif' }}>
                  Jogue em tela cheia, com ícone na tela inicial — como um app.
                </div>
              </div>
              <button onClick={dismiss} className="text-gray-500 hover:text-white text-xl font-black flex-shrink-0 leading-none px-1">✕</button>
            </div>

            {iosHint ? (
              <div className="mt-3 rounded-xl px-3 py-2.5 text-[12px] leading-relaxed"
                style={{ background: '#14142a', border: '1px solid #1d1d2f', color: '#CFCFE0', fontFamily: 'Rajdhani, sans-serif' }}>
                No Safari: toque em <b style={{ color: '#fff' }}>Compartilhar</b> <span aria-hidden>⬆️</span> e depois em
                <b style={{ color: '#fff' }}> "Adicionar à Tela de Início"</b> <span aria-hidden>➕</span>.
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <button onClick={dismiss}
                  className="flex-1 py-2.5 rounded-xl font-black tracking-widest text-sm"
                  style={{ fontFamily: 'Rajdhani, sans-serif', background: 'transparent', border: '1px solid #2A2A3A', color: '#8A8A9A' }}>
                  AGORA NÃO
                </button>
                <button onClick={install}
                  className="flex-1 py-2.5 rounded-xl font-black tracking-widest text-sm"
                  style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.1em', background: 'linear-gradient(135deg, #C9A84C, #E8C84A)', color: '#080810' }}>
                  INSTALAR
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
