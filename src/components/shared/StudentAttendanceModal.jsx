import { useState, useEffect } from 'react';
import { X, CalendarCheck, Download } from 'lucide-react';
import api from '../../services/api';
import LoadingSpinner from './LoadingSpinner';
import { HQ } from '../halaqa/primitives';
import { downloadStudentReport } from '../../utils/studentReport';

/* سجل حضور الطالب — يُفتح من شارة الحضور في إدارة المستخدمين.
   البيانات من GET /reports/student/:id (قسم attendance الجاهز) — بلا باكند جديد. */

const STATUS_AR = {
  present: { label: 'حاضر', color: HQ.MENTOR, bg: HQ.MENTOR_WASH },
  late: { label: 'متأخر', color: HQ.WARNING, bg: HQ.WARNING_WASH },
  absent: { label: 'غائب', color: HQ.ERROR, bg: HQ.ERROR_WASH },
  excused: { label: 'معذور', color: HQ.MUTED, bg: HQ.PAPER },
  scheduled: { label: 'مجدولة', color: HQ.MUTED, bg: HQ.PAPER },
};

export const rateTone = (rate) => rate >= 85
  ? { fg: HQ.MENTOR, bg: HQ.MENTOR_WASH }
  : rate >= 70
  ? { fg: HQ.WARNING, bg: HQ.WARNING_WASH }
  : { fg: HQ.ERROR, bg: HQ.ERROR_WASH };

export function AttendancePill({ rate, onClick, label }) {
  if (rate === null || rate === undefined) {
    return (
      <span style={{ fontSize: 12, fontWeight: 700, color: HQ.MUTED }}>
        الحضور: —
      </span>
    );
  }
  const t = rateTone(rate);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label || `عرض سجل الحضور — النسبة ${rate}%`}
      title="عرض سجل الحضور والغياب"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: t.bg, color: t.fg, border: 'none', borderRadius: 9999,
        padding: '4px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
        minHeight: 32, fontVariantNumeric: 'tabular-nums',
      }}
    >
      <CalendarCheck size={13} aria-hidden />
      الحضور {rate}%
    </button>
  );
}

function AttendanceBody({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await api.get(`/reports/student/${user._id}`);
      setData(res.data?.sections?.attendance || null);
    } catch {
      setData(null);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user._id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 32 }}><LoadingSpinner size="md" text="جارٍ جلب سجل الحضور..." /></div>;
  }

  if (failed || !data) {
    return (
      <div style={{ textAlign: 'center', padding: 32 }} role="alert">
        <p style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: HQ.INK }}>تعذّر تحميل سجل الحضور</p>
        <button type="button" onClick={load} className="hq-action" style={{ background: HQ.MENTOR, color: '#fff', padding: '0 24px', fontSize: 14 }}>
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const history = (data.history || []).slice(0, 5);
  const t = rateTone(data.rate ?? 100);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={{ flex: 1, minWidth: 90, textAlign: 'center', background: t.bg, color: t.fg, borderRadius: 12, padding: '8px 4px', fontWeight: 900, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>
          {data.rate ?? 0}%
          <span style={{ display: 'block', fontSize: 11, fontWeight: 700 }}>النسبة</span>
        </span>
        {[
          { v: data.present, l: 'حاضر' },
          { v: data.late, l: 'متأخر' },
          { v: data.absent, l: 'غائب' },
          { v: data.excused, l: 'معذور' },
        ].map((c) => (
          <span key={c.l} style={{ flex: 1, minWidth: 64, textAlign: 'center', background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: '8px 4px', fontWeight: 900, fontSize: 16, color: HQ.INK, fontVariantNumeric: 'tabular-nums' }}>
            {c.v ?? 0}
            <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: HQ.MUTED }}>{c.l}</span>
          </span>
        ))}
      </div>

      <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 900, color: HQ.INK }}>آخر الحصص</h4>
      {history.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: HQ.MUTED }}>لا توجد سجلات حضور بعد.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {history.map((h) => {
            const s = STATUS_AR[h.status] || STATUS_AR.scheduled;
            return (
              <li key={h.sessionId || h.title} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: `1px solid ${HQ.LINE}`, fontSize: 13 }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 800, color: HQ.INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title}</span>
                  <span style={{ display: 'block', fontSize: 12, color: HQ.MUTED }}>
                    {h.date ? new Date(h.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }) : '—'}
                    {h.teacherName ? ` · ${h.teacherName}` : ''}
                  </span>
                </span>
                <span style={{ flex: 'none', background: s.bg, color: s.color, borderRadius: 8, padding: '2px 10px', fontSize: 12, fontWeight: 800 }}>{s.label}</span>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        disabled={downloading}
        onClick={async () => {
          setDownloading(true);
          try { await downloadStudentReport(user); }
          catch { /* popup-blocked handled by browser */ }
          finally { setDownloading(false); }
        }}
        className="hq-action"
        style={{ width: '100%', marginTop: 14, background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14, opacity: downloading ? 0.6 : 1 }}
      >
        {downloading ? <LoadingSpinner size="sm" /> : <><Download size={15} /> التقرير الكامل للطباعة</>}
      </button>
    </div>
  );
}

export default function StudentAttendanceModal({ user, onClose }) {
  if (!user) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: HQ.SURFACE, borderRadius: 20, padding: 24, maxWidth: 560, width: '100%', border: `1px solid ${HQ.LINE}`, boxShadow: '0 10px 30px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: HQ.INK, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarCheck size={18} color={HQ.MENTOR} /> سجل الحضور والغياب
          </h3>
          <button type="button" onClick={onClose} aria-label="إغلاق نافذة سجل الحضور" style={{ background: 'none', border: 'none', cursor: 'pointer', color: HQ.MUTED }}>
            <X size={20} />
          </button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: HQ.MUTED }}>
          الطالب: <strong>{user.firstName} {user.lastName}</strong>
        </p>
        <AttendanceBody user={user} />
      </div>
    </div>
  );
}
