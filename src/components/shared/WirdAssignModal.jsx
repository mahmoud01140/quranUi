import { useState, useEffect } from 'react';
import { BookOpen, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import LoadingSpinner from './LoadingSpinner';
import QURAN_SURAHS from '../../utils/quranData';
import { HQ } from '../halaqa/primitives';

/* نافذة إعطاء ورد: حفظ جديد + ماضٍ (مستقلان) — تُحفظ وتظهر للطالب في "المطلوب مني".
   كل ركن اختياري مستقل: يمكن إسناد الجديد فقط أو الماضي فقط أو كليهما.
   إلغاء تفعيل ركن يمسحه من ورد اليوم فيرى الطالب المطلوب فقط. */

export default function WirdAssignModal({ open, studentId, studentName, onClose, onSaved }) {
  const [form, setForm] = useState({
    includeNew: true,
    surahNumber: 1, fromVerse: 1, toVerse: 7,
    includeNear: true,
    nearSurahNumber: 1, nearFromVerse: 1, nearToVerse: 7,
    note: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        includeNew: true,
        surahNumber: 1, fromVerse: 1, toVerse: 7,
        includeNear: true,
        nearSurahNumber: 1, nearFromVerse: 1, nearToVerse: 7,
        note: '',
      });
    }
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    if (!studentId) { toast.error('لا يوجد طالب مرتبط'); return; }
    if (!form.includeNew && !form.includeNear) {
      return toast.error('فعّل الحفظ الجديد أو الماضي على الأقل');
    }
    const payload = {};
    if (form.includeNew) {
      const s = QURAN_SURAHS.find(x => x.number === Number(form.surahNumber));
      const fv = Number(form.fromVerse), tv = Number(form.toVerse);
      if (!s || !(fv >= 1) || !(tv >= fv) || tv > s.verses) {
        return toast.error(`تحقق من آيات الحفظ الجديد (سورة ${s?.name || ''} بها ${s?.verses || '?'} آية)`);
      }
      payload.newHifz = { surahNumber: s.number, surahName: s.name, fromVerse: fv, toVerse: tv };
    } else {
      payload.clearNewHifz = true;
    }
    if (form.includeNear) {
      const ns = QURAN_SURAHS.find(x => x.number === Number(form.nearSurahNumber));
      const nfv = Number(form.nearFromVerse), ntv = Number(form.nearToVerse);
      if (!ns || !(nfv >= 1) || !(ntv >= nfv) || ntv > ns.verses) {
        return toast.error(`تحقق من آيات الماضي (سورة ${ns?.name || ''} بها ${ns?.verses || '?'} آية)`);
      }
      payload.nearRevision = { surahNumber: ns.number, surahName: ns.name, fromVerse: nfv, toVerse: ntv };
    } else {
      payload.clearNearRevision = true;
    }
    if (form.note?.trim()) {
      payload.additionalExercise = { title: 'توجيه المعلم', details: form.note.trim(), status: 'pending' };
    }
    setSaving(true);
    try {
      await api.put(`/daily-tasks/student/${studentId}/assign`, payload);
      toast.success('تم إرسال الورد للطالب — سيجده في "المطلوب مني" ✅');
      onClose();
      if (onSaved) onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'خطأ في حفظ الورد');
    } finally {
      setSaving(false);
    }
  };

  const numStyle = {
    width: '100%', minHeight: 44, marginTop: 4, borderRadius: 10,
    border: `1px solid ${HQ.LINE}`, background: HQ.SURFACE, color: HQ.INK, fontSize: 14, padding: '0 8px',
  };
  const selStyle = { ...numStyle, fontSize: 13 };
  const lblStyle = { fontSize: 12, fontWeight: 700, color: HQ.MUTED };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: HQ.SURFACE, borderRadius: 20, padding: 24, maxWidth: 520, width: '100%', border: `1px solid ${HQ.LINE}`, maxHeight: '90vh', overflowY: 'auto' }}
        dir="rtl" role="dialog" aria-modal="true" aria-label="إعطاء ورد للطالب">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: HQ.INK, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={18} color={HQ.MENTOR} /> إعطاء ورد للطالب
          </h3>
          <button type="button" onClick={onClose} aria-label="إغلاق" style={{ background: 'none', border: 'none', cursor: 'pointer', color: HQ.MUTED, minWidth: 40, minHeight: 40 }}>
            <X size={20} />
          </button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: HQ.MUTED }}>
          الطالب: <strong>{studentName || ''}</strong> — سيظهر الورد فوراً في "المطلوب مني" لديه.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 14, padding: 12, opacity: form.includeNew ? 1 : 0.55 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 8px', fontSize: 14, fontWeight: 900, color: HQ.INK, cursor: 'pointer', minHeight: 44 }}>
              <input type="checkbox" checked={form.includeNew} onChange={e => setForm(p => ({ ...p, includeNew: e.target.checked }))}
                style={{ width: 20, height: 20, accentColor: HQ.MENTOR, cursor: 'pointer', flex: 'none' }} />
              الحفظ الجديد
            </label>
            {form.includeNew && (
              <div className="m-form-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
                <label style={lblStyle}>السورة
                  <select value={form.surahNumber} onChange={e => setForm(p => ({ ...p, surahNumber: e.target.value }))} style={selStyle}>
                    {QURAN_SURAHS.map(s => <option key={s.number} value={s.number}>{s.number}. {s.name}</option>)}
                  </select>
                </label>
                <label style={lblStyle}>من آية
                  <input type="number" min={1} value={form.fromVerse} onChange={e => setForm(p => ({ ...p, fromVerse: e.target.value }))} style={numStyle} />
                </label>
                <label style={lblStyle}>إلى آية
                  <input type="number" min={1} value={form.toVerse} onChange={e => setForm(p => ({ ...p, toVerse: e.target.value }))} style={numStyle} />
                </label>
              </div>
            )}
          </div>

          <div style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 14, padding: 12, opacity: form.includeNear ? 1 : 0.55 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 8px', fontSize: 14, fontWeight: 900, color: HQ.INK, cursor: 'pointer', minHeight: 44 }}>
              <input type="checkbox" checked={form.includeNear} onChange={e => setForm(p => ({ ...p, includeNear: e.target.checked }))}
                style={{ width: 20, height: 20, accentColor: HQ.MENTOR, cursor: 'pointer', flex: 'none' }} />
              الماضي (مراجعة)
            </label>
            {form.includeNear && (
              <div className="m-form-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
                <label style={lblStyle}>السورة
                  <select value={form.nearSurahNumber} onChange={e => setForm(p => ({ ...p, nearSurahNumber: e.target.value }))} style={selStyle}>
                    {QURAN_SURAHS.map(s => <option key={s.number} value={s.number}>{s.number}. {s.name}</option>)}
                  </select>
                </label>
                <label style={lblStyle}>من آية
                  <input type="number" min={1} value={form.nearFromVerse} onChange={e => setForm(p => ({ ...p, nearFromVerse: e.target.value }))} style={numStyle} />
                </label>
                <label style={lblStyle}>إلى آية
                  <input type="number" min={1} value={form.nearToVerse} onChange={e => setForm(p => ({ ...p, nearToVerse: e.target.value }))} style={numStyle} />
                </label>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="wird-note-shared" style={{ display: 'block', fontSize: 13, fontWeight: 800, color: HQ.INK, marginBottom: 4 }}>
              توجيه إضافي <span style={{ color: HQ.MUTED, fontWeight: 500 }}>(اختياري)</span>
            </label>
            <input id="wird-note-shared" type="text" value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
              placeholder="مثال: ركز على أحكام الميم الساكنة"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: `1px solid ${HQ.LINE}`, background: HQ.PAPER, fontSize: 14, color: HQ.INK }} />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} className="hq-action"
              style={{ flex: 1, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14 }}>
              إلغاء
            </button>
            <button type="button" onClick={handleSave} disabled={saving} className="hq-action"
              style={{ flex: 1, background: HQ.MENTOR, color: '#fff', fontSize: 14, opacity: saving ? 0.6 : 1 }}>
              {saving ? <LoadingSpinner size="sm" /> : 'إرسال الورد للطالب'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
