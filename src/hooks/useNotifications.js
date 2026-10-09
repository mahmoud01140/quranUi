import { useEffect, useRef } from 'react';
import useNotificationStore from '../store/notificationStore';
import useAuthStore from '../store/authStore';
import usePolling from './usePolling';
import api from '../services/api';
import toast from 'react-hot-toast';

const POLL_MS = 30000;
const DUE_POLL_MS = 60000;

/**
 * useNotifications — Vercel-safe polling replacement for socket.io push.
 * - Polls GET /notifications every 30s (pauses when tab hidden via usePolling).
 * - Toasts only genuinely new notification IDs.
 * - Live sessions are detected separately via GET /live/active/me polling
 *   (StudentDashboard + LiveClassPage), so no socket events needed here.
 */
export default function useNotifications() {
  const { notifications, fetchNotifications, addNotification } = useNotificationStore();
  const seenRef = useRef(new Set((notifications || []).map((n) => n._id?.toString())));
  const firstRunRef = useRef(true);

  // Initial load once
  useEffect(() => {
    fetchNotifications().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  usePolling(async () => {
    try {
      const res = await api.get('/notifications');
      const list = res.data?.notifications || [];
      if (firstRunRef.current) {
        firstRunRef.current = false;
        list.forEach((n) => seenRef.current.add(n._id?.toString()));
        useNotificationStore.setState({
          notifications: list.slice(0, 50),
          unreadCount: res.data?.unreadCount ?? list.filter((n) => !n.isRead).length,
        });
        return;
      }
      const fresh = list.filter((n) => !seenRef.current.has(n._id?.toString()));
      if (fresh.length > 0) {
        fresh.forEach((n) => {
          seenRef.current.add(n._id?.toString());
          addNotification(n);
          toast(n.title || 'إشعار جديد', { icon: '🔔', duration: 5000 });
        });
        // Keep unread count in sync without full refetch loop
        useNotificationStore.setState({
          notifications: list.slice(0, 50),
          unreadCount: res.data?.unreadCount ?? list.filter((n) => !n.isRead).length,
        });
      }
    } catch (_) {}
  }, POLL_MS);

  // Staff only: due-session alerts (~every 60s). The backend notifies once per
  // session (dueNotifiedAt flag) via DB + Web Push; here we toast immediately
  // and pre-mark the created notification ids as seen so the 30s poll above
  // doesn't toast them a second time.
  usePolling(async () => {
    try {
      const role = useAuthStore.getState()?.user?.role;
      if (role !== 'admin' && role !== 'teacher') return;
      const res = await api.get('/live/due');
      const sessions = res.data?.sessions || [];
      (res.data?.notifiedIds || []).forEach((id) => seenRef.current.add(String(id)));
      sessions.forEach((s) => {
        toast(`⏰ حان موعد حصة: ${s.title || 'جلسة مباشرة'}${s.ownerName ? ` — ${s.ownerName}` : ''}`, {
          icon: '⏰',
          duration: 10000,
        });
      });
    } catch (_) {}
  }, DUE_POLL_MS);
}
