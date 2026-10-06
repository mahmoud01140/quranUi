import { useState, useEffect } from 'react';
import { Award, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import LoadingSpinner from './LoadingSpinner';
import { HQ } from '../halaqa/primitives';

/* تقييم تسميع الطالب أثناء/بعد البث: درجة كل ركن (0-100) + ملاحظات المعلم.
   تُحفظ عبر PUT /daily-tasks/:id/review (الموجود مسبقاً) وتظهر في التقارير
   المطبوعة وعند ولي الأمر — دون أي تأثير على سير البث. */

const scoreStyle = {
  width: '100%', minHeight: 48, marginTop: 4, borderRadius: 10,
  border: `1px solid ${HQ.LINE}`, background: HQ.SURFACE, color: HQ.INK,
  fontSize: 16, fontWeight: 800, padding: '0 12px', fontVariantNumeric: 'tabular-nums',
};

function portionLabel(p, fallback) {
  if (!p?.surahName) return null;
  return `سورة ${p.surahName} · الآيات (${p.fromVerse} - ${p.toVerse})`;
}

export default function RecitationEvalModal({ open, studentId, studentName, onClose, onSaved }) {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scores, setScores] = useState({ newHifzScore: '', nearRevisionScore: '' });
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open || !studentId) return;
    setTask(null);
    setScores({ newHifzScore: '', nearRevisionScore: '' });
    setNotes('');
    setLoading(true);
    api.get(`/daily-tasks/student/${studentId}/today`)
      .then(res => {
        const t = res.data?.task || null;
        setTask(t);
        if (t) {
          setScores({
            newHifzScore: t.newHifz?.score ?? '',
            nearRevisionScore: t.nearRevision?.score ?? '',
          });
          setNotes(t.teacherNotes || '');
        }
      })
      .catch(() => toast.error('تعذر جلب ورد اليوم'))
      .finally(() => setLoading(false));
  }, [open, studentId]);

  if (!open) return null;

  const numOrUndefined = (v) => {
    if (v === '' || v === null || v === undefined) return undefined;
    const n = Math.max(0, Math.min(100, Number(v)));
    return Number.isNaN(n) ? undefined : n;
  };

  const handleSave = async () => {
    if (!task?._id) { toast.error('لا يوجد ورد اليوم لتقييمه — أسند ورداً أولاً'); return; }
    const payload = {};
    const n1 = numOrUndefined(scores.newHifzScore);
    const n2 = numOrUndefined(scores.nearRevisionScore);
    if (task.newHifz?.surahName && n1 !== undefined) payload.newHifzScore = n1;
    if (task.nearRevision?.surahName && n2 !== undefined) payload.nearRevisionScore = n2;
    if (notes?.trim()) payload.teacherNotes = notes.trim();
    if (Object.keys(payload).length === 0) {
      return toast.error('أدخل درجة أو ملاحظة واحدة على الأقل');
    }
    setSaving(true);
    try {
      await api.put(`/daily-tasks/${task._id}/review`, payload);
      toast.success('تم حفظ تقييم التسميع — سيظهر في التقارير وعند ولي الأمر ⭐');
      onClose();
      if (onSaved) onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'خطأ في حفظ التقييم');
    } finally {
      setSaving(false);
    }
  };

  const newLabel = portionLabel(task?.newHifz);
  const nearLabel = portionLabel(task?.nearRevision);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: HQ.SURFACE, borderRadius: 20, padding: 24, maxWidth: 520, width: '100%', border: `1px solid ${HQ.LINE}`, maxHeight: '90vh', overflowY: 'auto' }}
        dir="rtl" role="dialog" aria-modal="true" aria-label="تقييم التسميع">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: HQ.INK, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Award size={18} color="#B45309" /> تقييم التسميع
          </h3>
          <button type="button" onClick={onClose} aria-label="إغلاق" style={{ background: 'none', border: 'none', cursor: 'pointer', color: HQ.MUTED, minWidth: 40, minHeight: 40 }}>
            <X size={20} />
          </button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: HQ.MUTED }}>
          الطالب: <strong>{studentName || ''}</strong> — الدرجات والملاحظات تظهر في التقارير وعند ولي الأمر.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 32 }}><LoadingSpinner size="md" text="جارٍ جلب ورد اليوم..." /></div>
        ) : !task ? (
          <p style={{ margin: 0, fontSize: 14, color: HQ.MUTED }}>لا يوجد ورد اليوم — أسند ورداً للطالب أولاً ثم قيّم تسميعه.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {newLabel && (
              <div style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 14, padding: 12 }}>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 900, color: HQ.INK }}>الحفظ الجديد</p>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: HQ.MUTED }}>{newLabel}</p>
                <label style={{ fontSize: 12, fontWeight: 700, color: HQ.MUTED }}>
                  الدرجة (0 - 100)
                  <input type="number" min={0} max={100} value={scores.newHifzScore}
                    onChange={e => setScores(p => ({ ...p, newHifzScore: e.target.value }))} style={scoreStyle} />
                </label>
              </div>
            )}
            {nearLabel && (
              <div style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 14, padding: 12 }}>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 900, color: HQ.INK }}>الماضي</p>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: HQ.MUTED }}>{nearLabel}</p>
                <label style={{ fontSize: 12, fontWeight: 700, color: HQ.MUTED }}>
                  الدرجة (0 - 100)
                  <input type="number" min={0} max={100} value={scores.nearRevisionScore}
                    onChange={e => setScores(p => ({ ...p, nearRevisionScore: e.target.value }))} style={scoreStyle} />
                </label>
              </div>
            )}
            {!newLabel && !nearLabel && (
              <p style={{ margin: 0, fontSize: 14, color: HQ.MUTED }}>ورد اليوم فارغ — أسند الحفظ الجديد أو الماضي أولاً.</p>
            )}

            <div>
              <label htmlFor="recite-notes" style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 4 }}>
                ملاحظات المعلم على التسميع
              </label>
              <textarea id="recite-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                placeholder="مثال: إتقان ممتاز للحفظ الجديد، يحتاج مراجعة أحكام النون الساكنة في الماضي"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: `1px solid ${HQ.LINE}`, background: HQ.PAPER, fontSize: 14, color: HQ.INK, resize: 'vertical', minHeight: 72 }} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={onClose} className="hq-action"
                style={{ flex: 1, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14 }}>
                إلغاء
              </button>
              <button type="button" onClick={handleSave} disabled={saving} className="hq-action"
                style={{ flex: 1, background: HQ.MENTOR, color: '#fff', fontSize: 14, opacity: saving ? 0.6 : 1 }}>
                {saving ? <LoadingSpinner size="sm" /> : 'حفظ التقييم'}
              </button>
            </div>
          </div>
        )}

        {!loading && !task && (
          <button type="button" onClick={onClose} className="hq-action"
            style={{ width: '100%', marginTop: 16, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14 }}>
            إغلاق
          </button>
        )}
      </div>
    </div>
  );
}
