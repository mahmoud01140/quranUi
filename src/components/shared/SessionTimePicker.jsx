import { HQ } from '../../components/halaqa/primitives';
import { formatTime12Ar } from '../../utils/helpers';

/* منتقي وقت بنظام 12 ساعة: الساعة (1-12) + الدقيقة + الفترة (صباحاً/مساءً).
   القيمة المخزنة تبقى "HH:MM" بنظام 24 ساعة لتوافق الباك إند ومنع التعارض. */

const pad = (n) => String(n).padStart(2, '0');

function parse24(value) {
  const [h = 18, m = 0] = (value || '18:00').split(':').map(Number);
  const hh = Number.isNaN(h) ? 18 : h;
  const mm = Number.isNaN(m) ? 0 : m;
  return { period: hh >= 12 ? 'pm' : 'am', h12: hh % 12 || 12, min: mm };
}

export default function SessionTimePicker({ value, onChange, selectStyle = {} }) {
  const { period, h12, min } = parse24(value);

  const emit = (nextH12, nextMin, nextPeriod) => {
    let h24 = (nextH12 % 12);
    if (nextPeriod === 'pm') h24 += 12;
    onChange(`${pad(h24)}:${pad(nextMin)}`);
  };

  const base = {
    background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 12,
    minHeight: 48, fontSize: 15, fontWeight: 700, color: HQ.INK, fontFamily: 'inherit',
    padding: '0 10px', ...selectStyle,
  };

  return (
    <div>
      <div className="m-timepick" style={{ display: 'flex', gap: 8 }} dir="rtl">
        <label style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: HQ.MUTED, marginBottom: 4 }}>الساعة</span>
          <select value={h12} onChange={e => emit(Number(e.target.value), min, period)}
            aria-label="الساعة بنظام 12 ساعة" style={{ ...base, width: '100%' }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </label>
        <label style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: HQ.MUTED, marginBottom: 4 }}>الدقيقة</span>
          <select value={min} onChange={e => emit(h12, Number(e.target.value), period)}
            aria-label="الدقيقة" style={{ ...base, width: '100%' }}>
            {Array.from({ length: 60 }, (_, i) => i).map(mn => (
              <option key={mn} value={mn}>{pad(mn)}</option>
            ))}
          </select>
        </label>
        <label style={{ flex: 1.2 }}>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: HQ.MUTED, marginBottom: 4 }}>الفترة</span>
          <select value={period} onChange={e => emit(h12, min, e.target.value)}
            aria-label="صباحاً أو مساءً" style={{ ...base, width: '100%' }}>
            <option value="am">صباحاً</option>
            <option value="pm">مساءً</option>
          </select>
        </label>
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 13, fontWeight: 800, color: HQ.MENTOR }}>
        الموعد المحدد: {formatTime12Ar(value)}
      </p>
    </div>
  );
}
