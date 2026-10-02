import { ChevronDown } from 'lucide-react';
import { HQ } from './primitives';

/* Al-Halaqa live primitives. Presentation only — all data and handlers
   come from the page through props. No mock data anywhere. */

export function WirdCard({ task, open, onToggle }) {
  const rows = [
    task?.newHifz?.surahName && { label: 'الحفظ الجديد', value: `سورة ${task.newHifz.surahName} — الآيات ${task.newHifz.fromVerse} إلى ${task.newHifz.toVerse}` },
    task?.nearRevision?.surahName && { label: 'الماضي القريب', value: `سورة ${task.nearRevision.surahName} — الآيات ${task.nearRevision.fromVerse} إلى ${task.nearRevision.toVerse}` },
    task?.cumulativeRevision?.surahName && { label: 'الورد التمكيني', value: `${task.cumulativeRevision.surahName}` },
    task?.additionalExercise?.details && { label: 'تدريب', value: task.additionalExercise.details },
  ].filter(Boolean);
  return (
    <section aria-label="وردك اليوم" style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 16 }}>
      <button type="button" onClick={onToggle} aria-expanded={open}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 48 }}>
        <span style={{ fontSize: 17, fontWeight: 800, color: HQ.INK }}>وردك اليوم</span>
        <ChevronDown size={18} color={HQ.MUTED} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
      </button>
      {open && (
        <div style={{ marginTop: 8 }}>
          {rows.length ? rows.map((r, i) => (
            <div key={i} style={{ padding: '8px 0', borderTop: i ? `1px solid ${HQ.LINE}` : 'none' }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: HQ.MENTOR }}>{r.label}</span>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: HQ.INK }}>{r.value}</span>
            </div>
          )) : (
            <p style={{ fontSize: 14, color: HQ.MUTED }}>تابع مع المعلم لتحديد وردك.</p>
          )}
        </div>
      )}
    </section>
  );
}

/* Compact presence — opens the drawer, never eats stage space */
export function PresenceBar({ state = 'joined', onOpen, pinging = false }) {
  const label = pinging ? 'المعلم ينادي الحضور — أكّد وجودك' : state === 'joined' ? 'أنت في الحلقة الآن' : 'بانتظار الانضمام';
  return (
    <button type="button" onClick={onOpen}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 48,
        background: HQ.SURFACE, border: `1px solid ${pinging ? HQ.MENTOR : HQ.LINE}`,
        borderRadius: 9999, padding: '8px 16px', fontSize: 14, fontWeight: 700, color: HQ.INK,
        cursor: 'pointer', width: '100%', justifyContent: 'center',
      }}>
      <span className={pinging ? '' : 'hq-live-dot'} aria-hidden
        style={pinging ? { width: 10, height: 10, borderRadius: 9999, background: HQ.MENTOR, flex: 'none' } : undefined} />
      {label}
    </button>
  );
}
