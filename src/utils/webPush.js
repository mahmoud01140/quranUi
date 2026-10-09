import api from '../services/api';

/* تفعيل Web Push الحقيقي: إذن المتصفح -> تسجيل الـ Service Worker ->
   اشتراك Push بمفتاح VAPID -> حفظ الاشتراك في حساب المستخدم.
   يُرجع 'granted' | 'denied' | 'unsupported' ويُرمي خطأً عند فشل تقني. */

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function isWebPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

export async function enableWebPush() {
  if (!isWebPushSupported()) return 'unsupported';

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';

  // مفتاح VAPID العام من السيرفر (علني بطبيعته)
  const { data } = await api.get('/auth/vapid-key');
  const vapidKey = data?.key;
  if (!vapidKey) throw new Error('مفتاح الإشعارات غير مُعد على الخادم');

  const registration =
    (await navigator.serviceWorker.getRegistration('/')) ||
    (await navigator.serviceWorker.register('/sw.js'));

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  }

  // حفظ الاشتراك الحقيقي (endpoint موجود مسبقاً)
  await api.put('/auth/push-subscription', { subscription: subscription.toJSON() });
  return 'granted';
}

export default enableWebPush;
