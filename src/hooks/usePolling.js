import { useEffect, useRef } from 'react';

/**
 * usePolling — بديل Vercel-safe لـ socket.io.
 * ينفذ callback كل intervalMs مع:
 * - إيقاف تلقائي عند إخفاء التبويب (توفير invocations على Vercel)
 * - منع التداخل (لا طلب جديد قبل انتهاء السابق)
 * - تنظيف تلقائي عند unmount
 *
 * @param {Function} callback - async function to run each tick
 * @param {number|null} intervalMs - null/0 للإيقاف
 * @param {Array} deps - إعادة التشغيل عند تغيرها
 */
export default function usePolling(callback, intervalMs, deps = []) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!intervalMs || intervalMs <= 0) return;
    let stopped = false;
    let inFlight = false;
    let timeoutId = null;

    const tick = async () => {
      if (stopped) return;
      // Skip when tab hidden — saves Vercel function calls + battery
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        timeoutId = setTimeout(tick, intervalMs);
        return;
      }
      if (!inFlight) {
        inFlight = true;
        try {
          await callbackRef.current();
        } catch (_) {
          // Silent: polling must never crash the page
        } finally {
          inFlight = false;
        }
      }
      if (!stopped) timeoutId = setTimeout(tick, intervalMs);
    };

    timeoutId = setTimeout(tick, intervalMs);
    return () => {
      stopped = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);
}
