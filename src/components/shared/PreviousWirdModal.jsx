import { useState, useEffect } from 'react';
import { BookOpen, X } from 'lucide-react';
import api from '../../services/api';
import LoadingSpinner from './LoadingSpinner';
import { HQ } from '../halaqa/primitives';
import { formatDateAr } from '../../utils/helpers';

/* الورد المطلوب تسميعه: آخر ورد مُسند قبل اليوم (أي ورد البث السابق).
   عرض فقط — يُفتح من غرفة البث ليعرف المعلم ما سيُسمّعه الطالب. */

function portionRow(label, p, tone) {
  if (!p?.surahName) return null;
  return (
    <div style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: '10px 14px' }}>
      <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 800, color: tone.fg, background: tone.bg, padding: '2px 8px', borderRadius: 6, marginBottom: 4 }}>
        {label}
      </span>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: HQ.INK }}>
        سورة {p.surahName} · الآيات ({p.fromVerse} - {p.toVerse})
      </p>
      {p.score !== undefined && p.score !== null && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: HQ.MUTED }}>تقييمه السابق: <strong style={{ color: HQ.MENTOR }}>{p.score}%</strong></p>
      )}
    </div>
  );
}

export default function PreviousWirdModal({ open, studentId, studentName, onClose }) {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || !studentId) return;
    setTask(null);
    setFailed(false);
    setLoading(true);
    api.get(`/daily-tasks/student/${studentId}/previous`)
      .then(res => setTask(res.data?.task || null))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [open, studentId]);

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: HQ.SURFACE, borderRadius: 20, padding: 24, maxWidth: 520, width: '100%', border: `1px solid ${HQ.LINE}`, maxHeight: '90vh', overflowY: 'auto' }}
        dir="rtl" role="dialog" aria-modal="true" aria-label="الورد المطلوب تسميعه">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: HQ.INK, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={18} color={HQ.MENTOR} /> الورد المطلوب تسميعه
          </h3>
          <button type="button" onClick={onClose} aria-label="إغلاق" style={{ background: 'none', border: 'none', cursor: 'pointer', color: HQ.MUTED, minWidth: 40, minHeight: 40 }}>
            <X size={20} />
          </button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: HQ.MUTED }}>
          الطالب: <strong>{studentName || ''}</strong> — آخر ورد أُسند قبل اليوم.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 32 }}><LoadingSpinner size="md" text="جارٍ جلب الورد السابق..." /></div>
        ) : failed ? (
          <p style={{ margin: 0, fontSize: 14, color: '#C2410C' }}>تعذر جلب الورد السابق — حاول مجدداً.</p>
        ) : !task ? (
          <p style={{ margin: 0, fontSize: 14, color: HQ.MUTED }}>لا يوجد ورد سابق لهذا الطالب بعد.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ margin: 0, fontSize: 12, color: HQ.MUTED }}>بتاريخ: {formatDateAr(task.date || task.createdAt)}</p>
            {portionRow('الحفظ الجديد', task.newHifz, { fg: HQ.MENTOR, bg: '#E2EFE7' })}
            {portionRow('الماضي', task.nearRevision, { fg: '#4A3F6B', bg: '#EDE9FF' })}
            {!task.newHifz?.surahName && !task.nearRevision?.surahName && (
              <p style={{ margin: 0, fontSize: 14, color: HQ.MUTED }}>الورد السابق فارغ.</p>
            )}
            {task.teacherNotes && (
              <div style={{ background: '#F8EDD3', border: '1px solid #D9A441', borderRadius: 12, padding: '10px 14px' }}>
                <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 800, color: '#7C5A12' }}>ملاحظة التقييم السابق</p>
                <p style={{ margin: 0, fontSize: 14, color: HQ.INK, lineHeight: 1.7 }}>{task.teacherNotes}</p>
              </div>
            )}
          </div>
        )}

        <button type="button" onClick={onClose} className="hq-action"
          style={{ width: '100%', marginTop: 16, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14 }}>
          إغلاق
        </button>
      </div>
    </div>
  );
}
