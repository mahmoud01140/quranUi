import { useState, useRef, useEffect } from 'react';
import { Bell, Check, CheckCheck, Trash2, X, Radio, FileText, ClipboardList, Users, BookOpen, MessageCircle, CreditCard, Clock, BellRing, Sparkles, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useNotificationStore from '../../store/notificationStore';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';
import { timeAgoAr } from '../../utils/helpers';
import { enableWebPush, isWebPushSupported, getPushPermissionState } from '../../utils/webPush';
import '../../components/halaqa/halaqa.css';
import { HQ } from '../../components/halaqa/primitives';

/* Notification center — same fetch, read, delete and routing logic.
   Type icons are Lucide here (the constants' emoji are not rendered). */

const TYPE_ICON = {
  live_starting: Radio,
  exam_scheduled: FileText,
  result_ready: ClipboardList,
  group_assigned: Users,
  plan_updated: BookOpen,
  message: MessageCircle,
  discussion_reply: MessageCircle,
  payment_submitted: CreditCard,
  payment_approved: CreditCard,
  payment_rejected: CreditCard,
  session_due: Clock,
  general: Bell,
};

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [pushStatus, setPushStatus] = useState(() => getPushPermissionState());
  const [isEnablingPush, setIsEnablingPush] = useState(false);
  const [isTestingPush, setIsTestingPush] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead, deleteNotification } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();
    setPushStatus(getPushPermissionState());
  }, []);

  const handleEnablePush = async () => {
    if (!isWebPushSupported()) {
      toast.error('المتصفح أو الاتصال الحالي لا يدعم Web Push (يتطلب HTTPS أو Localhost)');
      return;
    }
    setIsEnablingPush(true);
    try {
      const res = await enableWebPush();
      setPushStatus(res);
      if (res === 'granted') {
        toast.success('تم تفعيل إشعارات المتصفح بنجاح! ستصلك التنبيهات حتى والموقع مغلق 🔔');
      } else if (res === 'denied') {
        toast.error('تم رفض الإذن. يمكنك السماح به يدوياً من إعدادات المتصفح.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'تعذر تفعيل إشعارات المتصفح');
    } finally {
      setIsEnablingPush(false);
    }
  };

  const handleTestPush = async () => {
    setIsTestingPush(true);
    try {
      const res = await api.post('/notifications/test-push');
      toast.success(res.data?.message || 'تم إرسال إشعار تجريبي للمتصفح!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'تعذر إرسال الإشعار التجريبي');
    } finally {
      setIsTestingPush(false);
    }
  };


  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleNotificationClick = (notif) => {
    if (!notif.isRead) markAsRead(notif._id);
    setIsOpen(false);

    if (notif.data?.link) {
      navigate(notif.data.link);
      return;
    }

    const role = user?.role || 'student';
    const rolePrefix = role === 'admin' ? '/admin' : role === 'teacher' ? '/teacher' : '/student';

    switch (notif.type) {
      case 'live_starting':
        navigate(role === 'student' ? '/student/live' : '/admin/live');
        break;
      case 'exam_scheduled':
      case 'result_ready':
      case 'grade_posted':
        navigate(`${rolePrefix}/exams`);
        break;
      case 'group_assigned':
        navigate(role === 'teacher' ? '/teacher' : '/student/curriculum');
        break;
      case 'plan_updated':
        navigate(role === 'teacher' ? '/teacher' : role === 'admin' ? '/admin/users' : '/student/curriculum');
        break;
      case 'message':
      case 'general':
      default:
        // No specific route, just read it
        break;
    }
  };

  const iconBtn = {
    minWidth: 44, minHeight: 44, borderRadius: 12, border: 'none', background: 'transparent',
    color: HQ.MUTED, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <div className="halaqa relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-xl"
        style={{ ...iconBtn, position: 'relative', color: HQ.INK }}
        aria-label={unreadCount > 0 ? `الإشعارات (${unreadCount} غير مقروءة)` : 'الإشعارات'}
        aria-expanded={isOpen}
      >
        <Bell size={19} aria-hidden />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4, minWidth: 18, height: 18, padding: '0 4px',
            background: '#C2410C', color: '#fff', fontSize: '0.8125rem', fontWeight: 800,
            borderRadius: 9999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 mt-2 w-80 overflow-hidden"
            style={{
              maxWidth: 'calc(100vw - 1.5rem)', background: HQ.SURFACE, borderRadius: 18,
              boxShadow: '0 12px 32px rgba(42,36,56,0.16)', border: `1px solid ${HQ.LINE}`, zIndex: 50,
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${HQ.LINE}` }}>
              <h3 className="font-bold" style={{ color: HQ.INK, margin: 0 }}>الإشعارات</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-xs flex items-center gap-1"
                    style={{ color: HQ.MENTOR, background: 'none', border: 'none', cursor: 'pointer', minHeight: 44, fontWeight: 800 }}
                  >
                    <CheckCheck size={14} aria-hidden />
                    قراءة الكل
                  </button>
                )}
                <button type="button" onClick={() => setIsOpen(false)} aria-label="إغلاق الإشعارات" style={{ ...iconBtn, minWidth: 44, minHeight: 44 }}>
                  <X size={16} aria-hidden />
                </button>
              </div>
            </div>

            {/* Web Push Banner */}
            {isWebPushSupported() && pushStatus !== 'granted' && pushStatus !== 'denied' && (
              <div className="px-3.5 py-2.5 mx-3 mt-2.5 mb-1 rounded-xl flex items-center justify-between gap-2.5" style={{ background: '#F4F9F5', border: '1px solid #D1E7DD' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span style={{ color: HQ.MENTOR, display: 'inline-flex' }}><BellRing size={16} /></span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color: HQ.INK, margin: 0 }}>تفعيل إشعارات المتصفح</p>
                    <p className="text-[11px] truncate" style={{ color: HQ.MUTED, margin: 0 }}>لتصلك التنبيهات حتى والموقع مغلق</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleEnablePush}
                  disabled={isEnablingPush}
                  className="text-xs px-2.5 py-1.5 rounded-lg font-bold text-white transition-opacity"
                  style={{ background: HQ.MENTOR, border: 'none', cursor: isEnablingPush ? 'default' : 'pointer', opacity: isEnablingPush ? 0.7 : 1, flexShrink: 0 }}
                >
                  {isEnablingPush ? 'جارٍ...' : 'تفعيل'}
                </button>
              </div>
            )}

            {isWebPushSupported() && pushStatus === 'granted' && (
              <div className="px-3 py-1.5 mx-3 mt-2 mb-1 rounded-lg flex items-center justify-between" style={{ background: '#F8F9FA', border: `1px solid ${HQ.LINE}` }}>
                <span className="text-[11px] flex items-center gap-1 font-medium" style={{ color: HQ.MENTOR }}>
                  <Check size={13} />
                  إشعارات المتصفح مفعّلة
                </span>
                <button
                  type="button"
                  onClick={handleTestPush}
                  disabled={isTestingPush}
                  className="text-[11px] font-bold px-2 py-0.5 rounded transition-opacity"
                  style={{ color: HQ.INK, background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, cursor: isTestingPush ? 'default' : 'pointer' }}
                >
                  {isTestingPush ? 'جارٍ...' : 'تجربة إشعار 🚀'}
                </button>
              </div>
            )}

            {pushStatus === 'denied' && (
              <div className="px-3 py-1.5 mx-3 mt-2 mb-1 rounded-lg text-[11px] text-amber-800 bg-amber-50 border border-amber-200">
                ⚠️ إشعارات المتصفح محظورة. يمكنك السماح بها من إعدادات المتصفح.
              </div>
            )}

            {/* Notifications list */}
            <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
              {notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell size={38} color={HQ.LINE} style={{ margin: '0 auto 8px' }} aria-hidden />
                  <p className="text-sm" style={{ color: HQ.MUTED, margin: 0 }}>لا توجد إشعارات</p>
                </div>
              ) : (
                notifications.map((notif) => {
                  const Icon = TYPE_ICON[notif.type] || Bell;
                  return (
                    <div
                      key={notif._id}
                      onClick={() => handleNotificationClick(notif)}
                      role="button" tabIndex={0}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNotificationClick(notif); } }}
                      className="flex gap-3 px-4 py-3 cursor-pointer"
                      style={{
                        borderBottom: `1px solid ${HQ.LINE}`,
                        background: !notif.isRead ? HQ.PAPER : HQ.SURFACE,
                      }}
                    >
                      <span aria-hidden style={{
                        width: 36, height: 36, borderRadius: 12, flex: 'none',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: '#E2EFE7', color: HQ.MENTOR,
                      }}>
                        <Icon size={17} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: HQ.INK, margin: 0 }}>{notif.title}</p>
                        <p className="text-xs mt-0.5" style={{ color: HQ.MUTED, marginBottom: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{notif.body}</p>
                        <p className="text-xs mt-1" style={{ color: HQ.MUTED, marginBottom: 0 }}>{timeAgoAr(notif.sentAt)}</p>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        {!notif.isRead && <span aria-hidden style={{ width: 8, height: 8, borderRadius: 9999, background: HQ.MENTOR }} />}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); deleteNotification(notif._id); }}
                          aria-label="حذف الإشعار"
                          style={{ ...iconBtn, minWidth: 36, minHeight: 36, color: '#C2410C' }}
                        >
                          <Trash2 size={13} aria-hidden />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
