import { format, formatDistanceToNow, isToday, isTomorrow } from 'date-fns';
import { ar } from 'date-fns/locale';

// Format date in Arabic
export const formatDateAr = (date, formatStr = 'dd MMMM yyyy') => {
  if (!date) return '';
  return format(new Date(date), formatStr, { locale: ar });
};

// Time ago in Arabic
export const timeAgoAr = (date) => {
  if (!date) return '';
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ar });
};

// Format schedule day label
export const getSmartDateLabel = (date) => {
  const d = new Date(date);
  if (isToday(d)) return 'اليوم';
  if (isTomorrow(d)) return 'غداً';
  return formatDateAr(d, 'EEEE dd MMMM');
};

// Format time string "09:00" to "9:00 ص"
export const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'م' : 'ص';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
};

// Format time string "18:00" to 12-hour system "6:00 مساءً" / "9:30 صباحاً"
export const formatTime12Ar = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return '';
  const [h, m] = timeStr.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return timeStr;
  const period = h >= 12 ? 'مساءً' : 'صباحاً';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
};

// Get avatar initials
export const getInitials = (firstName, lastName) => {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
};

// Get avatar background color from name
export const getAvatarColor = (name = '') => {
  const colors = ['#1D9E75', '#534AB7', '#BA7517', '#3B82F6', '#EF4444', '#8B5CF6', '#F59E0B'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

// Format file size
export const formatFileSize = (bytes) => {
  if (!bytes) return '0 بايت';
  const k = 1024;
  const sizes = ['بايت', 'كيلوبايت', 'ميغابايت', 'غيغابايت'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

// Format duration in minutes to Arabic
export const formatDuration = (minutes) => {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} دقيقة`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} ساعة و${m} دقيقة` : `${h} ساعة`;
};

// Calculate percentage circle path (SVG)
export const getCirclePath = (percentage, radius = 54) => {
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  return { circumference, strokeDashoffset: offset };
};

// Truncate text
export const truncate = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// Countdown timer format
export const formatCountdown = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// Juz progress percentage
export const getJuzPercentage = (completedJuz = []) => {
  return Math.round((completedJuz.length / 30) * 100);
};

// Error message extractor
export const getErrorMessage = (error) => {
  return error?.response?.data?.message || error?.message || 'حدث خطأ غير متوقع';
};

// Generate color from level (Al-Halaqa identity: mentor/guide/neutral.
// Teacher operational voice is violet; gold is reserved for achievements.)
export const getLevelColor = (level) => {
  const map = {
    foundation:  { bg: '#E2EFE7', text: '#177B58', border: '#177B58' },
    memorization: { bg: '#ECE9F4', text: '#4A3F6B', border: '#4A3F6B' },
    teacher_prep: { bg: '#ECE9F4', text: '#4A3F6B', border: '#4A3F6B' },
    senior:       { bg: '#FBF7EE', text: '#2A2438', border: '#E8E2D4' },
  };
  return map[level] || { bg: '#FBF7EE', text: '#756E85', border: '#E8E2D4' };
};

export const getLevelLabel = (level) => {
  const map = {
    foundation:   'التأسيس',
    memorization: 'التحفيظ',
    teacher_prep: 'إعداد معلم',
    senior:       'كبار السن',
  };
  return map[level] || level;
};

// ── Subscription access (single source of truth, evaluated by the server) ──
// Shape comes from GET /payments/my-history → subscription (evaluateUserSubscription):
// { status, isExpired, isTrial, trialSessionsAttended, trialSessionsAllowed, canAccessLiveSession }
export const isSubscriptionBlocked = (sub) => {
  if (!sub) return false; // fail-open: never lock the student out on network/config errors
  if (sub.isExpired) return true;
  const attended = sub.trialSessionsAttended || 0;
  const allowed = sub.trialSessionsAllowed || 1;
  const trialUsed = attended >= allowed;
  const active = sub.status === 'active' && !sub.isExpired;
  if (trialUsed && !active) return true;
  if (sub.canAccessLiveSession === false && !active) return true;
  return false;
};

export const getSubscriptionBlockReason = (sub) => {
  if (!sub) return '';
  if (sub.isExpired) return 'expired';
  return 'trial_used';
};

// ── Admin subscription badge (raw user.subscription subdocument) ──
// Returns { key, label, tone, days } — days = remaining days or null
export const getSubscriptionInfo = (sub) => {
  if (!sub) return { key: 'none', label: 'بلا اشتراك', tone: 'neutral', days: null };
  const end = sub.endDate ? new Date(sub.endDate) : null;
  const expired = end ? end <= new Date() : sub.status === 'expired';
  if (sub.status === 'active' && !expired) {
    const days = end ? Math.max(0, Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24))) : null;
    return { key: 'active', label: 'مشترك نشط', tone: 'mentor', days };
  }
  const attended = sub.trialSessionsAttended || 0;
  const allowed = sub.trialSessionsAllowed || 1;
  if (!expired && attended < allowed) {
    return { key: 'trial', label: 'تجريبي', tone: 'gold', days: null };
  }
  return { key: 'expired', label: 'منتهي', tone: 'neutral', days: 0 };
};

// ── Unified "no group yet" copy — same expectation on every student screen ──
export const NO_GROUP_TITLE = 'لم تُعيَّن في مجموعة بعد';
export const NO_GROUP_HINT = 'الإدارة تسكّنك في مجموعة تناسب مستواك — ريثما يتم ذلك تابع المصحف ووردك اليومي.';
