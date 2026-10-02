import { useState, useEffect, useRef } from 'react';
import { BookOpen, X } from 'lucide-react';
import toast from 'react-hot-toast';
import QURAN_SURAHS from '../../utils/quranData';
import { HQ } from '../halaqa/primitives';

/* لوحة المصحف المشترك — نص الآيات فقط بلا فيديو.
   interactive: المعلم يتنقل (سورة + من/إلى) ويُبلَّغ الأب عبر onNavigate (مُخفَّض).
   read-only: عرض متزامن لما يشاركه المعلم. */

export default function MushafSharePanel({
  range,
  interactive = false,
  sharing = false,
  onToggleShare,
  onNavigate,
  onClose,
  title = 'المصحف المشترك',
}) {
  const [surah, setSurah] = useState(range?.surah || 1);
  const [from, setFrom] = useState(range?.from || 1);
  const [to, setTo] = useState(range?.to || 7);
  const [verses, setVerses] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  // مزامنة القيم القادمة من الخارج (تنقل المعلم)
  useEffect(() => {
    if (range?.surah) {
      setSurah(range.surah);
      setFrom(range.from || 1);
      setTo(range.to || range.from || 7);
    }
  }, [range?.surah, range?.from, range?.to]);

  // جلب نص السورة مرة واحدة لكل سورة
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`https://api.alquran.cloud/v1/surah/${surah}`);
        const data = await res.json();
        if (!cancelled && data.code === 200) setVerses(data.data?.ayahs || []);
      } catch (_) {
        if (!cancelled) setVerses([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [surah]);

  // إبلاغ مخفَّض عند تنقل المعلم (800ms) — حفاظاً على الأداء
  useEffect(() => {
    if (!interactive || !onNavigate) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onNavigate({ surah, from: Number(from) || 1, to: Number(to) || Number(from) || 1 });
    }, 800);
    return () => clearTimeout(debounceRef.current);
  }, [surah, from, to, interactive, onNavigate]);

  const surahMeta = QURAN_SURAHS.find(s => s.number === Number(surah));
  const f = Math.max(1, Number(from) || 1);
  const t = Math.max(f, Number(to) || f);
  const shown = verses.filter(v => v.numberInSurah >= f && v.numberInSurah <= t);

  const numStyle = {
    width: '100%', minHeight: 44, marginTop: 4, borderRadius: 10,
    border: `1px solid ${HQ.LINE}`, background: HQ.SURFACE, color: HQ.INK, fontSize: 14, padding: '0 8px',
  };

  return (
    <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flex: 'none' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: HQ.INK, display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={17} color={HQ.MENTOR} /> {title}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {interactive && onToggleShare && (
            <button
              type="button"
              onClick={onToggleShare}
              aria-pressed={sharing}
              className="hq-action"
              style={{
                background: sharing ? HQ.MENTOR : HQ.PAPER, color: sharing ? '#fff' : HQ.MENTOR,
                border: sharing ? 'none' : `1.5px solid ${HQ.MENTOR}`, padding: '0 16px', fontSize: 13,
              }}
            >
              {sharing ? 'مشارَك مع الطالب ✓' : 'مشاركة مع الطالب'}
            </button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} aria-label="إغلاق المصحف"
              style={{ minWidth: 40, minHeight: 40, borderRadius: 10, border: 'none', background: 'transparent', color: HQ.MUTED, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {interactive && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, flex: 'none' }} className="m-form-grid">
          <label style={{ fontSize: 12, fontWeight: 700, color: HQ.MUTED }}>السورة
            <select value={surah} onChange={e => setSurah(Number(e.target.value))}
              style={{ ...numStyle, fontSize: 13 }} aria-label="اختيار السورة">
              {QURAN_SURAHS.map(s => <option key={s.number} value={s.number}>{s.number}. {s.name}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, fontWeight: 700, color: HQ.MUTED }}>من آية
            <input type="number" min={1} value={from} onChange={e => setFrom(e.target.value)} style={numStyle} aria-label="من آية" />
          </label>
          <label style={{ fontSize: 12, fontWeight: 700, color: HQ.MUTED }}>إلى آية
            <input type="number" min={1} value={to} onChange={e => setTo(e.target.value)} style={numStyle} aria-label="إلى آية" />
          </label>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 14, padding: '14px 16px' }}>
        {loading ? (
          <p style={{ fontSize: 14, color: HQ.MUTED, textAlign: 'center', margin: '24px 0' }}>جارٍ تحميل الآيات...</p>
        ) : shown.length === 0 ? (
          <p style={{ fontSize: 14, color: HQ.MUTED, textAlign: 'center', margin: '24px 0' }}>
            {interactive ? 'اختر السورة والآيات لعرضها ومشاركتها' : 'بانتظار ما يشاركه المعلم...'}
          </p>
        ) : (
          <div className="hq-quran" dir="rtl" style={{ fontSize: 20, lineHeight: 2.2, color: HQ.INK }}>
            <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: HQ.MUTED, fontFamily: 'inherit' }}>
              سورة {surahMeta?.name || ''} — الآيات {f} إلى {t}
            </p>
            {shown.map(v => (
              <span key={v.number} style={{
                display: 'inline', padding: '2px 6px', borderRadius: 8,
                background: '#FCEFC7', color: '#7C5A12', fontWeight: 700,
                boxShadow: 'inset 0 0 0 2px #D9A441',
              }}>
                {v.text} <span style={{ fontSize: 14 }}>﴿{v.numberInSurah}﴾</span>{' '}
              </span>
            ))}
          </div>
        )}
      </div>
      {!interactive && (
        <p style={{ margin: 0, fontSize: 12, color: HQ.MUTED, textAlign: 'center', flex: 'none' }}>
          عرض فقط — المعلم يتحكم في التنقل
        </p>
      )}
    </div>
  );
}
