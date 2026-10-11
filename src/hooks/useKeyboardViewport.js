import { useEffect } from 'react';

/* Keeps the chat shell above the on-screen keyboard on iOS.
   iOS Safari overlays the keyboard without resizing the layout viewport,
   so 100dvh never shrinks there. The visualViewport DOES shrink — we
   publish its height as --hq-vv and flag .hq-kb on <html> while the
   keyboard is visible; halaqa.css uses them to re-fit the shell.
   On Android (interactive-widget=resizes-content) the heuristic below
   never fires because window.innerHeight shrinks together with vv. */
export default function useKeyboardViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;

    let raf = 0;
    const apply = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const kbOpen = window.innerHeight - vv.height > 120;
        document.documentElement.classList.toggle('hq-kb', kbOpen);
        document.documentElement.style.setProperty('--hq-vv', `${vv.height}px`);
      });
    };

    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    apply();

    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove('hq-kb');
    };
  }, []);
}
