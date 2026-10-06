import toast from 'react-hot-toast';
import api from '../services/api';

/**
 * فحص مسبق لحالة اشتراك الطالب قبل بدء البث (GET subscription-check).
 * fail-open: عند فشل الفحص يُرجع null ويُترك البث يستمر دون عرقلة.
 */
export async function fetchSubscriptionWarning(studentId) {
  if (!studentId) return null;
  try {
    const res = await api.get(`/live/student/${studentId}/subscription-check`);
    return res.data?.subscriptionWarning || null;
  } catch {
    return null;
  }
}

/** التحذيرات التي تستوجب سؤال الأدمن قبل البث (منتهٍ / غير مشترك). */
export function isBlockingWarning(warning) {
  return !!warning && (warning.type === 'expired' || warning.type === 'not_subscribed');
}

/**
 * يعرض تحذير الاشتراك الراجع من POST /api/live/student/:id/start.
 * يُستدعى بعد نجاح بدء البث — toast يبقى ظاهراً حتى بعد التنقل لصفحة البث
 * (عكس الـ modal الذي سيختفي مع التنقل).
 *
 * @param {{ type: 'expired'|'not_subscribed'|'expiring_soon', title: string, message: string } | null} warning
 * @returns {boolean} true إذا عُرض تحذير
 */
export function notifySubscriptionWarning(warning) {
  if (!warning?.message) return false;

  if (warning.type === 'expiring_soon') {
    toast(warning.message, {
      icon: '⏳',
      duration: 6000,
      style: {
        border: '2px solid #D9A441',
        background: '#F8EDD3',
        color: '#7C5A12',
        fontWeight: 700,
      },
    });
    return true;
  }

  // expired / not_subscribed — تحذير بارز لا يختفي بسرعة
  toast(warning.message, {
    icon: '⚠️',
    duration: 12000,
    style: {
      border: '2px solid #C2410C',
      background: '#FDECE4',
      color: '#7C2D12',
      fontWeight: 800,
    },
  });
  return true;
}

export default notifySubscriptionWarning;
