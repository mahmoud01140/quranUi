import { useEffect } from 'react';
import useNotificationStore from '../store/notificationStore';
import { getSocket } from '../services/socket';
import toast from 'react-hot-toast';

export default function useNotifications() {
  const { addNotification } = useNotificationStore();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNotification = (notification) => {
      addNotification(notification);
      toast(notification.title, {
        icon: '🔔',
        duration: 5000,
      });
    };

    const handleLiveStarting = ({ sessionId, groupId, startsIn }) => {
      const msg = startsIn
        ? `تبدأ الجلسة المباشرة خلال ${startsIn} دقائق`
        : 'انطلقت الجلسة المباشرة الآن!';
      addNotification({
        _id: `live-${sessionId}`,
        type: 'live_starting',
        title: '🔴 جلسة مباشرة',
        body: msg,
        sentAt: new Date(),
        isRead: false,
      });
      toast.success(msg, { duration: 8000 });
    };

    const handleResultReady = ({ resultId, examTitle }) => {
      addNotification({
        _id: `result-${resultId}`,
        type: 'result_ready',
        title: '📋 نتيجة الامتحان جاهزة',
        body: `تمت مراجعة امتحانك. اطلع على النتيجة.`,
        sentAt: new Date(),
        isRead: false,
        data: { resultId },
      });
      toast.success('نتيجة امتحانك جاهزة!');
    };

    socket.on('notification', handleNotification);
    socket.on('live-starting-soon', handleLiveStarting);
    socket.on('broadcast-started', handleLiveStarting);
    socket.on('result-ready', handleResultReady);

    return () => {
      socket.off('notification', handleNotification);
      socket.off('live-starting-soon', handleLiveStarting);
      socket.off('broadcast-started', handleLiveStarting);
      socket.off('result-ready', handleResultReady);
    };
  }, [addNotification]);
}
