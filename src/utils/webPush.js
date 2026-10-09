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
  if (typeof window === 'undefined') return false;
  // Service Workers require HTTPS or localhost
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isLocal && window.location.protocol !== 'https:') return false;

  return (
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

export function getPushPermissionState() {
  if (!isWebPushSupported()) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function enableWebPush() {
  if (!isWebPushSupported()) return 'unsupported';

  // Request browser notification permission
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm;

  // 1. Fetch public VAPID key from backend
  const { data } = await api.get('/auth/vapid-key');
  const vapidKey = data?.key?.trim?.();
  if (!vapidKey) throw new Error('مفتاح الإشعارات غير مُعد على الخادم (VAPID key not configured)');

  // 2. Ensure Service Worker is registered & active
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  const registration = await navigator.serviceWorker.ready;

  // 3. Inspect existing subscription (check for key mismatch)
  let subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    try {
      const expectedKey = urlBase64ToUint8Array(vapidKey);
      const currentKeyBuf = subscription.options?.applicationServerKey;
      let isMatch = false;

      if (currentKeyBuf) {
        const currentKeyArr = new Uint8Array(currentKeyBuf);
        if (currentKeyArr.length === expectedKey.length) {
          isMatch = currentKeyArr.every((byte, idx) => byte === expectedKey[idx]);
        }
      }

      // If the existing subscription was created with a different VAPID key, renew it
      if (!isMatch) {
        await subscription.unsubscribe();
        subscription = null;
      }
    } catch (_) {
      try { await subscription.unsubscribe(); } catch (_) {}
      subscription = null;
    }
  }

  // 4. Create new subscription if needed
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  }

  // 5. Save subscription to current user's profile in backend
  await api.put('/auth/push-subscription', { subscription: subscription.toJSON() });
  return 'granted';
}

export async function disableWebPush() {
  if (!isWebPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }
  } catch (_) {}
  try {
    await api.put('/auth/push-subscription', { subscription: null });
  } catch (_) {}
}

/**
 * Background auto-sync: If user already granted permission, ensure subscription
 * is active and saved in the database without prompting.
 */
export async function syncPushSubscription() {
  if (!isWebPushSupported()) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  try {
    await enableWebPush();
  } catch (err) {
    console.debug('Silent push sync skipped or failed:', err?.message);
  }
}

export default enableWebPush;

