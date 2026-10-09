/* Service Worker لمنصة التحفيظ — يستقبل Web Push حتى والموقع مغلق.
   يُسجَّل من main.jsx — لا منطق عمل هنا، عرض الإشعار وفتح الرابط فقط. */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { title: 'منصة التحفيظ', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'منصة تحفيظ القرآن';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/quran-icon.svg',
    badge: payload.badge || '/quran-icon.svg',
    dir: 'rtl',
    lang: 'ar',
    tag: (payload.data && payload.data.tag) || 'quran-notif',
    renotify: true,
    data: { url: (payload.data && payload.data.url) || '/', ...(payload.data || {}) },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windows) => {
        for (const win of windows) {
          try {
            const target = new URL(url, self.location.origin).href;
            if (win.url === target || win.url.split('#')[0] === target.split('#')[0]) {
              return win.focus();
            }
          } catch (_) {}
        }
        return self.clients.openWindow(url);
      })
  );
});
