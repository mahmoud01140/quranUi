import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, MotionConfig, AnimatePresence } from 'framer-motion';
import {
  Clock, Check, BookOpen, RefreshCw, LogOut, Bell, Sparkles,
  Volume2, ShieldCheck, ChevronDown, ChevronUp, HelpCircle,
  Headphones, Users, Calendar, ArrowLeft, CheckCircle2, MessageCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import useSocket from '../../hooks/useSocket';
import api from '../../services/api';
import { getLevelLabel, formatTime12Ar } from '../../utils/helpers';
import './Onboarding.css';

const FAQS = [
  {
    q: 'كم يستغرق تدقيق التلاوة وجدولة حصصي؟',
    a: 'تستغرق المراجعة عادة بين ساعتين إلى 24 ساعة كحد أقصى؛ حيث يستمع أحد المقرئين المتخصصين لتسجيلاتك الشفهية بعناية لتحديد المستوى الأدق، ثم جدولة حصصك بما يناسب جدولك ومستواك.',
  },
  {
    q: 'متى يبدأ سداد الاشتراك ورسوم التحفيظ؟',
    a: 'لا يوجد أي سداد مطلوب الآن! حسابك يبدأ بحصة تجريبية مجانية بعد اعتماد مستواك مباشرة لتتعرف على معلمك وأسلوب الحصة قبل أي التزام مالي.',
  },
  {
    q: 'ماذا لو كان موعد حصتي غير مناسب لجدولي؟',
    a: 'يمكنك بكل سهولة وبضغطة زر طلب تغيير موعد حصتك بالتواصل المباشر مع الإدارة لاختيار موعد بديل يناسب أوقات فراغك.',
  },
  {
    q: 'كيف سأعرف عندما تنتهي المراجعة ويتم اعتماد مستواي؟',
    a: 'ستصلك رسالة فورية عبر بريدك الإلكتروني المسجل، وإشعار على هاتفك أو متصفحك، كما تتحدث هذه الصفحة تلقائياً باللحظة دون الحاجة لإعادة تحميلها.',
  },
];

export default function WaitingApprovalPage() {
  const { user, checkAuth, refreshUser, logout } = useAuthStore();
  const navigate = useNavigate();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [showRecordings, setShowRecordings] = useState(false);
  const [pushStatus, setPushStatus] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  // Real-time synchronization via Socket.io
  useSocket({
    notification: async (notif) => {
      toast.success(notif?.title || 'تحديث جديد بخصوص مراجعة حسابك');
      const fresh = await refreshUser();
      if (fresh?.assignedLevel) {
        toast.success('مبارك! تم اعتماد مستواك بنجاح 🎉');
      }
    },
  });

  // Auto-poll every 15 seconds to ensure fresh state
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await refreshUser();
      } catch (_) {}
    }, 15000);
    return () => clearInterval(interval);
  }, [refreshUser]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const fresh = await refreshUser();
      await checkAuth();
      if (fresh?.assignedLevel && fresh?.scheduleDays?.length) {
        toast.success('تم اعتماد مستواك وجدولة حصصك بنجاح!');
      } else if (fresh?.assignedLevel) {
        toast.success(`تم اعتماد مستواك: ${getLevelLabel(fresh.assignedLevel)}`);
      } else {
        toast('المراجعة لا تزال جارية بعناية، شكراً لصبرك');
      }
    } catch (_) {
      toast.error('تعذر التحقق من الاتصال');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleEnablePush = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('المتصفح لا يدعم الإشعارات الفورية');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setPushStatus(perm);
      if (perm === 'granted') {
        toast.success('تم تفعيل إشعارات المتصفح بنجاح! سننبهك فور اعتمادك.');
        try {
          await api.put('/auth/push-subscription', {
            subscription: { browserEnabled: true, timestamp: new Date() },
          });
        } catch (_) {}
      } else {
        toast.error('تم رفض الإشعارات في المتصفح');
      }
    } catch (_) {
      toast.error('تعذر تفعيل الإشعارات');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const hasLevel = Boolean(user?.assignedLevel);
  const hasSchedule = Boolean(user?.scheduleDays?.length);
  const levelLabel = hasLevel ? getLevelLabel(user.assignedLevel) : null;
  const recordingsCount = user?.oralExamRecordings?.length || 0;

  const steps = [
    {
      id: 1,
      title: 'استلام الاختبار والتسجيلات',
      detail: `الامتحان التحريري: ${user?.placementExamScore !== undefined ? `${user.placementExamScore}%` : 'مكتمل'} · التسجيلات الشفهية: ${recordingsCount} تسجيلات`,
      done: true,
      current: false,
    },
    {
      id: 2,
      title: 'مراجعة تلاوتك واعتماد المستوى',
      detail: hasLevel ? `المستوى المعتمد: ${levelLabel}` : 'يستمع المقرئ لتسجيلك الشفهي بعناية لتحديد المستوى',
      done: hasLevel,
      current: !hasLevel,
    },
    {
      id: 3,
      title: 'جدولة مواعيد البث المباشر الفردي',
      detail: hasSchedule
        ? `أيام البث: ${user.scheduleDays.join('، ')} ${user.sessionTime ? `(الساعة ${formatTime12Ar(user.sessionTime)})` : ''}`
        : hasLevel
        ? 'يقوم المشرف حالياً بتحديد أيام وساعة جلسات البث المباشر معك'
        : 'جدولة الحصص المباشرة بعد اعتماد المستوى',
      done: hasSchedule,
      current: hasLevel && !hasSchedule,
    },
    {
      id: 4,
      title: 'جاهزية البث المباشر والمنهج',
      detail: hasLevel
        ? 'حسابك معتمد وجاهز؛ سيبدأ المشرف بث الحصة معك في موعدك المحدد'
        : 'بدء الجلسات المباشرة بعد الاعتماد والجدولة',
      done: hasLevel && hasSchedule,
      current: hasLevel && hasSchedule,
    },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <div className="onb" dir="rtl">
        <div className="max-w-2xl mx-auto px-4 py-8">
          
          {/* Top Bar with Status indicator and Logout */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="onb-pulse-dot" aria-hidden />
              <span className="text-xs font-bold" style={{ color: '#0F5940' }}>
                متابعة الاعتماد اللحظية المباشرة
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="onb-ghost text-xs flex items-center gap-1.5"
              style={{ color: '#756E85' }}
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden />
              تسجيل الخروج
            </button>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="onb-card mb-6 text-center"
          >
            {/* Header Icon based on state */}
            <div className="mx-auto mb-4 flex items-center justify-center" style={{
              width: 76,
              height: 76,
              borderRadius: 22,
              background: hasLevel ? '#ECE9F4' : '#E2EFE7',
            }}>
              {hasLevel ? (
                <ShieldCheck size={38} style={{ color: '#4A3F6B' }} />
              ) : (
                <Clock size={38} style={{ color: '#177B58' }} />
              )}
            </div>

            {/* Main Title & Subtitle */}
            <h1 className="font-extrabold mb-2" style={{ fontSize: '1.65rem', color: '#2A2438' }}>
              {hasLevel ? (
                `مبارك يا ${user?.firstName || 'طالبنا'}! تم اعتماد مستواك`
              ) : (
                `أهلاً بك يا ${user?.firstName || 'طالبنا'} — طلبك قيد المراجعة`
              )}
            </h1>

            <p className="mb-6 max-w-lg mx-auto text-sm" style={{ color: '#756E85', lineHeight: 1.8 }}>
              {hasLevel ? (
                <span>
                  تم اعتماد مستواك رسمياً: <strong style={{ color: '#0F5940' }}>{levelLabel}</strong>.
                  نحن الآن في الخطوة الأخيرة لجدولة حصصك المباشرة مع معلمك في الموعد الأنسب.
                </span>
              ) : (
                'لقد أتممت الاختبار بنجاح! يستمع أحد المقرئين المعتمدين لتلاوتك الشفهية لتحديد مستواك الدقيق وجدولة حصصك المباشرة.'
              )}
            </p>

            {/* Primary Action Button if ready */}
            {hasLevel && (
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => navigate('/student')}
                  className="onb-btn onb-btn-block flex items-center justify-center gap-2"
                  style={{ fontSize: '1.05rem', padding: '14px 28px' }}
                >
                  <BookOpen className="w-5 h-5" aria-hidden />
                  الدخول إلى لوحة الطالب وتصفح المصحف
                  <ArrowLeft className="w-4 h-4 mr-1" aria-hidden />
                </button>
              </div>
            )}

            {/* 4-Step Interactive Timeline */}
            <div className="rounded-2xl p-5 mb-6 text-right" style={{ background: '#FBF7EE' }}>
              <div className="flex items-center justify-between mb-4 pb-2 border-b" style={{ borderColor: '#E8E2D4' }}>
                <span className="text-xs font-bold" style={{ color: '#2A2438' }}>مسار اعتماد الطالب وجدولة حصصه</span>
                <span className="text-xs font-semibold" style={{ color: '#177B58' }}>
                  {hasLevel ? 'الخطوة 4 من 4 (75%)' : 'الخطوة 2 من 4 (35%)'}
                </span>
              </div>

              <ol className="space-y-4" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {steps.map((step) => (
                  <li key={step.id} className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className={`onb-stepdot mt-0.5 ${step.done ? 'done' : step.current ? 'now' : ''}`}
                    >
                      {step.done ? (
                        <Check size={14} strokeWidth={3.5} />
                      ) : (
                        step.id
                      )}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span
                          className="text-sm font-bold"
                          style={{
                            color: step.done ? '#2A2438' : step.current ? '#0F5940' : '#756E85',
                          }}
                        >
                          {step.title}
                        </span>
                        {step.current && (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold"
                            style={{ background: '#E2EFE7', color: '#0F5940' }}
                          >
                            <span className="onb-pulse-dot" style={{ width: 6, height: 6 }} aria-hidden />
                            قيد العمل الآن
                          </span>
                        )}
                        {step.done && (
                          <span className="text-xs font-bold" style={{ color: '#177B58' }}>مكتمل ✓</span>
                        )}
                      </div>
                      <p className="text-xs mt-1" style={{ color: '#756E85' }}>
                        {step.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Notification channels reassurance card */}
            <div className="onb-notice mb-6 text-right">
              <Bell className="w-5 h-5 flex-none mt-0.5" style={{ color: '#177B58' }} aria-hidden />
              <div className="flex-1">
                <p className="text-sm font-bold mb-1" style={{ color: '#2A2438' }}>قنوات إشعارك الفورية</p>
                <p className="text-xs leading-relaxed" style={{ color: '#756E85' }}>
                  فور اعتماد مستواك وجدولة حصصك، سنرسل لك إشعاراً فورياً على بريدك المسجل:
                  <strong className="block mt-0.5 text-xs" style={{ color: '#2A2438', direction: 'ltr', textAlign: 'right' }}>
                    {user?.email}
                  </strong>
                </p>

                {/* Push Notification Toggle */}
                <div className="mt-3 pt-3 border-t flex items-center justify-between flex-wrap gap-2" style={{ borderColor: '#E8E2D4' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium" style={{ color: '#2A2438' }}>
                      إشعارات المتصفح المباشرة:
                    </span>
                    {pushStatus === 'granted' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: '#177B58' }}>
                        <CheckCircle2 size={13} /> مفعلة على جهازك
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: '#756E85' }}>غير مفعلة بعد</span>
                    )}
                  </div>
                  {pushStatus !== 'granted' && (
                    <button
                      type="button"
                      onClick={handleEnablePush}
                      className="onb-btn-outline text-xs"
                      style={{ minHeight: 34, padding: '4px 14px', borderRadius: 8 }}
                    >
                      <Bell size={13} aria-hidden />
                      تفعيل إشعارات المتصفح
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Oral Recordings Review Audio Drawer (Calms the student about their submission) */}
            {recordingsCount > 0 && (
              <div className="mb-6 border rounded-2xl overflow-hidden text-right" style={{ borderColor: '#E8E2D4' }}>
                <button
                  type="button"
                  onClick={() => setShowRecordings(!showRecordings)}
                  className="w-full flex items-center justify-between p-4"
                  style={{ background: '#FBF7EE' }}
                >
                  <div className="flex items-center gap-2">
                    <Volume2 size={18} style={{ color: '#177B58' }} />
                    <span className="text-sm font-bold" style={{ color: '#2A2438' }}>
                      تسجيلاتك الصوتية المستلمة ({recordingsCount} مقاطع)
                    </span>
                  </div>
                  <span className="text-xs font-medium flex items-center gap-1" style={{ color: '#756E85' }}>
                    {showRecordings ? 'إخفاء التسجيلات' : 'استمع لتسجيلك للتأكد'}
                    {showRecordings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </button>

                <AnimatePresence>
                  {showRecordings && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="p-4 space-y-3"
                      style={{ background: '#FFFFFF' }}
                    >
                      <p className="text-xs" style={{ color: '#756E85' }}>
                        هذه التسجيلات الصوتية التي يستمع إليها المعلم حالياً لتقييم مخارج الحروف وأحكام التجويد:
                      </p>
                      {user.oralExamRecordings.map((url, idx) => (
                        <div key={idx} className="onb-audio-chip flex flex-col items-stretch gap-2">
                          <span className="text-xs font-bold" style={{ color: '#2A2438' }}>
                            المقطع الصوتي {idx + 1}
                          </span>
                          <audio controls src={url} style={{ height: 36, width: '100%' }} />
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Action Buttons */}
            {hasLevel && (
              <button
                type="button"
                onClick={() => navigate('/student')}
                className="onb-btn-primary w-full justify-center mb-3"
                style={{ background: '#177B58', color: '#fff', padding: '14px', borderRadius: 12, fontWeight: 800, fontSize: 15 }}
              >
                الدخول إلى لوحة المنهج والدراسة 🚀
              </button>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => navigate('/student/quran')}
                className="onb-btn-outline flex-1 justify-center"
              >
                <BookOpen className="w-4 h-4" aria-hidden />
                تصفح المصحف المكرر ريثما تنتهي المراجعة
              </button>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="onb-ghost flex-1 justify-center border"
                style={{ borderColor: '#E8E2D4', background: '#FFFFFF' }}
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden />
                {isRefreshing ? 'جارٍ التحقق...' : 'تحديث الحالة الآن'}
              </button>
            </div>
          </motion.div>

          {/* Productive Waiting Section: Tips to Prepare for First Class */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            className="onb-card mb-6 text-right"
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={18} style={{ color: '#177B58' }} />
              <h2 className="text-base font-extrabold" style={{ color: '#2A2438', margin: 0 }}>
                استعد لحلقتك الأولى (3 نصائح ذهبية)
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl border" style={{ background: '#FBF7EE', borderColor: '#E8E2D4' }}>
                <Headphones size={20} style={{ color: '#177B58', marginBottom: 8 }} />
                <h3 className="text-xs font-bold mb-1" style={{ color: '#2A2438' }}>جودة الصوت</h3>
                <p className="text-xs" style={{ color: '#756E85', lineHeight: 1.6 }}>
                  احرص على استخدام سماعات أذن ذات مايكروفون واضح لتصل تلاوتك نقية لمعلمك.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border" style={{ background: '#FBF7EE', borderColor: '#E8E2D4' }}>
                <Users size={20} style={{ color: '#177B58', marginBottom: 8 }} />
                <h3 className="text-xs font-bold mb-1" style={{ color: '#2A2438' }}>الهدوء والتركيز</h3>
                <p className="text-xs" style={{ color: '#756E85', lineHeight: 1.6 }}>
                  اختر مكاناً هادئاً بعيداً عن المشتتات، واحرص على الحضور قبل الحصة بـ 5 دقائق.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border" style={{ background: '#FBF7EE', borderColor: '#E8E2D4' }}>
                <BookOpen size={20} style={{ color: '#177B58', marginBottom: 8 }} />
                <h3 className="text-xs font-bold mb-1" style={{ color: '#2A2438' }}>المصحف والورد</h3>
                <p className="text-xs" style={{ color: '#756E85', lineHeight: 1.6 }}>
                  استخدم مصحف المنصة التفاعلي لتكرار الآيات والتدرب على الترتيل الصحيح.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Interactive FAQs Accordion */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.15 }}
            className="onb-card mb-6 text-right"
          >
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle size={18} style={{ color: '#177B58' }} />
              <h2 className="text-base font-extrabold" style={{ color: '#2A2438', margin: 0 }}>
                الأسئلة الشائعة حول الاعتماد والمراجعة
              </h2>
            </div>

            <div className="space-y-2.5">
              {FAQS.map((faq, i) => {
                const isOpen = openFaq === i;
                return (
                  <div key={i} className="onb-faq-item" onClick={() => setOpenFaq(isOpen ? null : i)}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold" style={{ color: '#2A2438' }}>
                        {faq.q}
                      </span>
                      {isOpen ? (
                        <ChevronUp size={17} style={{ color: '#756E85', flex: 'none' }} />
                      ) : (
                        <ChevronDown size={17} style={{ color: '#756E85', flex: 'none' }} />
                      )}
                    </div>
                    {isOpen && (
                      <p className="text-xs mt-2.5 pt-2.5 border-t leading-relaxed" style={{ color: '#756E85', borderColor: '#E8E2D4' }}>
                        {faq.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Contact Support for quick scheduling needs */}
          <div className="text-center p-4 rounded-2xl border" style={{ background: '#FFFFFF', borderColor: '#E8E2D4' }}>
            <p className="text-xs font-bold mb-1" style={{ color: '#2A2438' }}>
              هل لديك استفسار عاجل بخصوص أوقات الحلقات؟
            </p>
            <p className="text-xs mb-3" style={{ color: '#756E85' }}>
              فريق الدعم متاح للإجابة على أي ظرف خاص بجدولك الزمني.
            </p>
            <a
              href="mailto:support@livequran.app?subject=استفسار بخصوص موعد الحصة"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold"
              style={{ background: '#FBF7EE', border: '1px solid #E8E2D4', color: '#177B58' }}
            >
              <MessageCircle size={14} />
              مراسلة الإدارة بخصوص المواعيد
            </a>
          </div>

        </div>
      </div>
    </MotionConfig>
  );
}
