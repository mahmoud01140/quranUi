import { Check } from 'lucide-react';
import { getCirclePath, getInitials } from '../../utils/helpers';

/* Al-Halaqa presentational primitives (no data fetching, no logic).
   Palette lives in halaqa.css variables; keep classes inline so the
   components render even if the CSS import order shifts. */

const INK = '#2A2438';
const MUTED = '#756E85';
const LINE = '#E8E2D4';
const MENTOR = '#177B58';
const MENTOR_DEEP = '#0F5940';
const MENTOR_WASH = '#E2EFE7';
const GUIDE = '#4A3F6B';
const GUIDE_WASH = '#ECE9F4';
const GOLD = '#D9A441';
const GOLD_WASH = '#F8EDD3';
const PAPER = '#FBF7EE';
const SURFACE = '#FFFFFF';
const WARNING = '#B45309';
const WARNING_WASH = '#FEF3E2';
const ERROR = '#C2410C';
const ERROR_WASH = '#FDECEC';
const INFO = '#3B5BFD';

export const HQ = { INK, MUTED, LINE, MENTOR, MENTOR_DEEP, MENTOR_WASH, GUIDE, GUIDE_WASH, GOLD, GOLD_WASH, PAPER, SURFACE, WARNING, WARNING_WASH, ERROR, ERROR_WASH, INFO };

/* Avatar palette (halaqa only — shared helper untouched) */
const AVATAR_COLORS = ['#177B58', '#4A3F6B', '#B45309', '#3B5BFD', '#C2410C', '#6D5BA7', '#0F5940'];
export function hqAvatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function HqAvatar({ firstName, lastName, size = 40, ring = false }) {
  const name = `${firstName || ''} ${lastName || ''}`.trim();
  return (
    <span
      aria-hidden
      style={{
        width: size, height: size, borderRadius: 9999, flex: 'none',
        background: hqAvatarColor(name), color: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: size * 0.36,
        boxShadow: ring ? `0 0 0 3px ${PAPER}, 0 0 0 5px ${MENTOR}` : 'none',
      }}
    >
      {getInitials(firstName, lastName)}
    </span>
  );
}

export function HqBadge({ tone = 'mentor', children }) {
  const tones = {
    mentor: { bg: MENTOR_WASH, fg: MENTOR },
    guide: { bg: GUIDE_WASH, fg: GUIDE },
    gold: { bg: GOLD_WASH, fg: INK },
    neutral: { bg: '#F1EDE1', fg: MUTED },
  };
  const t = tones[tone] || tones.mentor;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: t.bg, color: t.fg, borderRadius: 9999,
      padding: '4px 12px', fontSize: 13, fontWeight: 700, lineHeight: 1.6,
    }}>
      {children}
    </span>
  );
}

export function HqStars({ value = 0, max = 5 }) {
  const full = Math.round(Number(value) || 0);
  return (
    <span style={{ display: 'inline-flex', gap: 2 }} role="img" aria-label={`التقييم ${full} من ${max}`}>
      {[1, 2, 3, 4, 5].map(s => (
        <svg key={s} width="14" height="14" viewBox="0 0 24 24"
          fill={s <= full ? GOLD : 'none'}
          stroke={s <= full ? GOLD : '#CFC9DB'} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );
}

/* The single living element of the journey screen */
export function KhatmRing({ pct = 0, done = 0, total = 30, size = 180 }) {
  const { circumference, strokeDashoffset } = getCirclePath(pct, 54);
  return (
    <div className="hq-ring" role="img" aria-label={`تقدم الختمة ${pct} بالمئة، ${done} من ${total} جزءًا`}
      style={{ width: size, height: size, borderRadius: 9999, position: 'relative', flex: 'none' }}>
      <svg width={size} height={size} viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }} aria-hidden>
        <circle cx="60" cy="60" r="54" fill="none" stroke={LINE} strokeWidth="11" />
        <circle cx="60" cy="60" r="54" fill="none" stroke={MENTOR} strokeWidth="11"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.3s ease' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 32, fontWeight: 900, color: INK, lineHeight: 1.2 }}>{pct}%</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: MUTED }}>{done} من {total}</span>
      </div>
    </div>
  );
}

export function RingSkeleton({ size = 180 }) {
  return <div className="hq-skeleton" style={{ width: size, height: size, borderRadius: 9999, flex: 'none' }} aria-hidden />;
}

export function NodeSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 16, padding: '16px 0' }} aria-hidden>
      <div className="hq-skeleton" style={{ width: 28, height: 28, borderRadius: 9999, flex: 'none' }} />
      <div style={{ flex: 1 }}>
        <div className="hq-skeleton" style={{ height: 20, width: '40%', marginBottom: 8 }} />
        <div className="hq-skeleton" style={{ height: 14, width: '75%' }} />
      </div>
    </div>
  );
}

export function GoldMark() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 28, borderRadius: 9999, background: GOLD_WASH, flex: 'none',
    }} aria-hidden>
      <Check size={16} strokeWidth={3} color={GOLD} />
    </span>
  );
}
