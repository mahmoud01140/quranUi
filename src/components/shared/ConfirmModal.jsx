import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { HQ } from '../halaqa/primitives';

/* مودال تأكيد موحد — بديل window.confirm (يدعم العربية والتصميم والجوال).
   open: الإظهار | danger: نمط الحذف | busy: حالة التنفيذ */

export default function ConfirmModal({
  open,
  title = 'تأكيد الإجراء',
  message = '',
  confirmLabel = 'تأكيد',
  cancelLabel = 'تراجع',
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}) {
  const accent = danger ? '#C2410C' : HQ.MENTOR;

  return (
    <AnimatePresence>
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0"
            style={{ background: 'rgba(42,36,56,0.55)' }}
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="halaqa relative w-full"
            style={{ maxWidth: 420, background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 20, padding: 24 }}
            dir="rtl"
            role="dialog" aria-modal="true" aria-label={title}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
              <span aria-hidden style={{
                width: 44, height: 44, borderRadius: 14, flex: 'none',
                background: danger ? '#FDECEC' : '#E2EFE7', color: accent,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AlertTriangle size={22} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: HQ.INK }}>{title}</h3>
                {message && (
                  <p style={{ margin: '6px 0 0', fontSize: 14, color: HQ.MUTED, lineHeight: 1.8 }}>{message}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق"
                style={{
                  minWidth: 40, minHeight: 40, borderRadius: 10, border: 'none',
                  background: 'transparent', color: HQ.MUTED, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
                }}
              >
                <X size={18} aria-hidden />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                onClick={onClose}
                className="hq-action"
                style={{ flex: 1, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14 }}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className="hq-action"
                style={{ flex: 1, background: accent, color: '#fff', fontSize: 14, opacity: busy ? 0.6 : 1 }}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
