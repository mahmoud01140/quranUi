import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, MotionConfig } from 'framer-motion';
import { BookOpen, Presentation, Users, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import ConfirmModal from '../../components/shared/ConfirmModal';
import './Onboarding.css';

const TONES = {
  mentor: { wash: '#E2EFE7', fg: '#177B58', deep: '#0F5940', border: '#177B58' },
  guide: { wash: '#ECE9F4', fg: '#4A3F6B', deep: '#4A3F6B', border: '#4A3F6B' },
  neutral: { wash: '#FBF7EE', fg: '#2A2438', deep: '#2A2438', border: '#2A2438' },
};

const types = [
  {
    id: 'student',
    Icon: BookOpen,
    tone: 'mentor',
    title: 'طالب تأسيس',
    desc: 'للمبتدئين والمتوسطين الراغبين في تعلم القراءة والتجويد وحفظ القرآن',
    features: ['منهج متدرج من الصفر', 'جلسات فردية مباشرة 1-1', 'جلسات مباشرة تفاعلية', 'خطة ختم مخصصة'],
  },
  {
    id: 'teacher',
    Icon: Presentation,
    tone: 'guide',
    title: 'إعداد معلم',
    desc: 'للراغبين في تطوير مهاراتهم التدريسية وتأهيل أنفسهم لتدريس القرآن',
    features: ['منهج التدريس المتقدم', 'تدريب على الأساليب التفاعلية', 'شهادة إعداد معلمين', 'فرص تدريس على المنصة'],
  },
  {
    id: 'senior',
    Icon: Users,
    tone: 'neutral',
    title: 'كبار السن',
    desc: 'برنامج خاص بوتيرة هادئة ومناسبة لمتطلبات كبار السن ومساعدتهم في التقنية',
    features: ['وتيرة دراسية هادئة', 'شاشة وأزرار كبيرة', 'دعم تقني مخصص', 'اهتمام فردي دافئ'],
  },
];

export default function RegistrationTypePage() {
  const { user, updateUser } = useAuthStore();
  const navigate = useNavigate();
  // Prefill the current choice so a returning student sees where they stand
  const [selected, setSelected] = useState(user?.registrationType || null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);

  const doNext = async () => {
    setIsLoading(true);
    try {
      await api.put(`/users/${user._id}`, { registrationType: selected });
      updateUser({ registrationType: selected });
      navigate('/onboarding/survey');
    } catch {
      toast.error('حدث خطأ. حاول مجدداً.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = async () => {
    if (!selected) { toast.error('الرجاء اختيار نوع التسجيل'); return; }
    if (!user?._id) { toast.error('انتهت الجلسة. سجل الدخول مجدداً.'); navigate('/login'); return; }
    // Switching tracks mid-onboarding orphans the saved survey answers and
    // changes the placement exam — confirm and clean up.
    if (user.registrationType && user.registrationType !== selected) {
      setShowSwitchConfirm(true);
      return;
    }
    await doNext();
  };

  const confirmSwitch = async () => {
    setShowSwitchConfirm(false);
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(`survey_answers_${user._id}_`))
        .forEach(k => localStorage.removeItem(k));
    } catch (_) {}
    await doNext();
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="onb" dir="rtl">
        <div className="max-w-3xl mx-auto px-4 py-12">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm mb-2">
              <span className="onb-badge">الخطوة 1 من 5</span>
              <span style={{ color: '#756E85' }}>اختيار نوع التسجيل</span>
            </div>
            <div className="onb-progress" role="progressbar" aria-valuenow={20} aria-valuemin={0} aria-valuemax={100} aria-label="تقدم التسجيل">
              <span style={{ width: '20%' }} />
            </div>
          </div>

          <div className="text-center mb-10">
            <h1 className="font-extrabold mb-3" style={{ fontSize: '2rem', lineHeight: 1.4, color: '#2A2438' }}>ما هو هدفك؟</h1>
            <p style={{ color: '#756E85' }}>اختر النوع الأنسب لك ليتم تخصيص منهجك وامتحانك التحديدي</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8" role="group" aria-label="أنواع التسجيل">
            {types.map((type, i) => {
              const tone = TONES[type.tone];
              const isSel = selected === type.id;
              return (
                <motion.button
                  key={type.id}
                  type="button"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.05 }}
                  onClick={() => setSelected(type.id)}
                  aria-pressed={isSel}
                  className="onb-card text-right cursor-pointer"
                  style={isSel
                    ? { border: `2px solid ${tone.border}`, background: tone.wash }
                    : undefined}
                >
                  {/* Radio indicator */}
                  <span className="flex justify-between items-start mb-4">
                    <span
                      aria-hidden
                      className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{ background: isSel ? '#FFFFFF' : tone.wash, color: tone.fg }}
                    >
                      <type.Icon size={28} strokeWidth={2} />
                    </span>
                    <span aria-hidden className={`onb-radio${isSel ? ' on' : ''}`} />
                  </span>
                  <span className="block font-extrabold mb-2" style={{ fontSize: '1.25rem', color: '#2A2438' }}>{type.title}</span>
                  <span className="block text-sm mb-4" style={{ color: '#756E85', lineHeight: 1.8 }}>{type.desc}</span>
                  <ul className="space-y-1.5" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {type.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2" style={{ fontSize: '0.8125rem', color: '#2A2438' }}>
                        <span
                          aria-hidden
                          className="w-4 h-4 rounded-full flex items-center justify-center flex-none"
                          style={{ background: tone.wash, color: tone.fg }}
                        >
                          <Check size={11} strokeWidth={3.5} />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </motion.button>
              );
            })}
          </div>

          <div className="m-cta-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="onb-ghost"
            >
              رجوع
            </button>
            <button
              onClick={handleNext}
              disabled={!selected || isLoading}
              className="onb-btn"
              style={{ paddingLeft: 48, paddingRight: 48 }}
            >
              {isLoading ? 'جارٍ الحفظ...' : 'التالي — الاستبيان'}
            </button>
          </div>
        </div>

        {/* Switch track confirm */}
        <ConfirmModal
          open={showSwitchConfirm}
          title="تغيير نوع التسجيل؟"
          message="سيتجاهل إجابات الاستبيان المحفوظة ويغير امتحان التحديد."
          confirmLabel="متابعة"
          busy={isLoading}
          onConfirm={confirmSwitch}
          onClose={() => setShowSwitchConfirm(false)}
        />
      </div>
    </MotionConfig>
  );
}
