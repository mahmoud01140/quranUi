import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, MotionConfig } from 'framer-motion';
import { Eye, EyeOff, Mail, Smartphone, Lock, BookOpen, ArrowRight, Info, CircleAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import './Auth.css';

export default function LoginPage() {
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [showPass, setShowPass] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [isFocused, setIsFocused] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!identifier.trim()) errs.identifier = 'رقم الهاتف أو البريد الإلكتروني مطلوب';
    if (!password) errs.password = 'كلمة المرور مطلوبة';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    try {
      const data = await login(identifier.trim(), password);
      toast.success(`مرحباً ${data.user.firstName}!`);
      const u = data.user;

      if (u.role === 'admin') navigate('/admin');
      else if (u.role === 'teacher') navigate('/teacher');
      else if (u.role === 'parent') navigate('/parent');
      else if (u.placementExamTaken) {
        // Already took the exam — go to dashboard or waiting
        if (u.assignedLevel) navigate('/student');
        else navigate('/waiting-approval');
      }
      else if (!u.assignedLevel) navigate('/onboarding/type');
      else navigate('/student');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'خطأ في تسجيل الدخول');
    }
  };

  const handleFocus = (field) => setIsFocused(prev => ({ ...prev, [field]: true }));
  const handleBlur = (field) => setIsFocused(prev => ({ ...prev, [field]: false }));

  return (
    <MotionConfig reducedMotion="user">
      <div className="auth" dir="rtl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-6 min-h-[44px]">
              <span
                aria-hidden
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: '#177B58' }}
              >
                <BookOpen className="w-5 h-5 text-white" />
              </span>
              <span className="font-bold text-lg" style={{ color: '#2A2438' }}>الحلقة</span>
            </Link>
            <h1 className="text-2xl font-extrabold" style={{ color: '#2A2438' }}>تسجيل الدخول</h1>
            <p className="mt-1" style={{ color: '#756E85' }}>مرحبًا بعودتك — سجّل دخولك لمتابعة رحلتك</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-card space-y-5">
            {/* Demo credentials hint (visible in dev mode only) */}
            {!import.meta.env.PROD && (
              <div className="auth-devbox">
                <p className="font-bold mb-1 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" aria-hidden />
                  بيانات تجريبية (بيئة التطوير):
                </p>
                <p className="text-xs opacity-80">Admin: admin@quran.com / Admin123!</p>
                <p className="text-xs opacity-80">معلم: teacher1@quran.com / Teacher123!</p>
                <p className="text-xs opacity-80">طالب: student1@quran.com / Student123!</p>
              </div>
            )}

            {/* Phone-or-email identifier field */}
            <div>
              <label htmlFor="login-identifier" className="auth-label">رقم الهاتف أو البريد الإلكتروني</label>
              <div className="relative">
                {identifier.includes('@') ? (
                  <Mail
                    aria-hidden
                    className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${isFocused.identifier ? 'text-[#177B58]' : 'text-[#756E85]'}`}
                  />
                ) : (
                  <Smartphone
                    aria-hidden
                    className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${isFocused.identifier ? 'text-[#177B58]' : 'text-[#756E85]'}`}
                  />
                )}
                <input
                  type="text"
                  inputMode={identifier.includes('@') ? 'email' : 'tel'}
                  value={identifier}
                  onChange={(e) => { setIdentifier(e.target.value); if (errors.identifier) setErrors(p => ({ ...p, identifier: null })); }}
                  onFocus={() => handleFocus('identifier')}
                  onBlur={() => handleBlur('identifier')}
                  className="auth-input pr-10"
                  style={{ direction: 'ltr', textAlign: 'left' }}
                  placeholder="01xxxxxxxxx"
                  id="login-identifier"
                  aria-invalid={Boolean(errors.identifier)}
                  aria-describedby={errors.identifier ? 'login-identifier-error' : undefined}
                />
              </div>
              {errors.identifier && (
                <p id="login-identifier-error" role="alert" className="auth-error">
                  <CircleAlert className="w-4 h-4 flex-none" aria-hidden />
                  {errors.identifier}
                </p>
              )}
            </div>

            {/* Password field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="auth-label" style={{ marginBottom: 0 }}>كلمة المرور</label>
                <Link to="/forgot-password" className="auth-link text-sm">
                  نسيت كلمة المرور؟
                </Link>
              </div>
              <div className="relative">
                <Lock
                  aria-hidden
                  className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${isFocused.password ? 'text-[#177B58]' : 'text-[#756E85]'}`}
                />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: null })); }}
                  onFocus={() => handleFocus('password')}
                  onBlur={() => handleBlur('password')}
                  className="auth-input pr-10 pl-12"
                  style={{ direction: 'ltr', textAlign: 'left' }}
                  placeholder="••••••••"
                  id="login-password"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'login-password-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="auth-iconbtn"
                  aria-label={showPass ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  aria-pressed={showPass}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p id="login-password-error" role="alert" className="auth-error">
                  <CircleAlert className="w-4 h-4 flex-none" aria-hidden />
                  {errors.password}
                </p>
              )}
            </div>

            <button type="submit" disabled={isLoading} className="auth-btn">
              {isLoading ? <LoadingSpinner size="sm" color="white" /> : 'تسجيل الدخول'}
            </button>

            <p className="text-center text-sm pt-1" style={{ color: '#756E85' }}>
              ليس لديك حساب؟{' '}
              <Link to="/register" className="auth-link text-sm">
                إنشاء حساب مجاناً
              </Link>
            </p>
          </form>

          {/* Back to home */}
          <div className="text-center mt-5">
            <Link to="/" className="auth-link-quiet">
              <ArrowRight className="w-3 h-3" aria-hidden />
              الرجوع للرئيسية
            </Link>
          </div>
        </motion.div>
      </div>
    </MotionConfig>
  );
}
