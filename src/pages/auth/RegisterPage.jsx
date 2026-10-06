import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, MotionConfig } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, BookOpen, Users, CircleAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import { validateRegisterForm, hasErrors } from '../../utils/validators';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import './Auth.css';

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="auth-error">
      <CircleAlert className="w-4 h-4 flex-none" aria-hidden />
      {message}
    </p>
  );
}

export default function RegisterPage() {
  const { register, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
    phone: '', dateOfBirth: '', gender: '', role: 'student',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateRegisterForm(form);
    if (hasErrors(errs)) { setErrors(errs); return; }

    try {
      const { firstName, lastName, email, password, phone, dateOfBirth, gender, role } = form;
      await register({ firstName, lastName, email, password, phone, dateOfBirth, gender, role });
      toast.success('تم إنشاء الحساب بنجاح!');
      if (role === 'parent') {
        navigate('/parent');
      } else {
        navigate('/onboarding/type');
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'خطأ في التسجيل');
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="auth" dir="rtl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-full max-w-lg"
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
            <h1 className="text-2xl font-extrabold" style={{ color: '#2A2438' }}>إنشاء حساب جديد</h1>
            <p className="mt-1" style={{ color: '#756E85' }}>ابدأ رحلتك مع القرآن الكريم اليوم</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-card space-y-4">
            {/* Account Type Selection */}
            <div>
              <span id="role-label" className="auth-label">نوع الحساب *</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="group" aria-labelledby="role-label">
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, role: 'student' }))}
                  aria-pressed={form.role === 'student'}
                  className="auth-role tone-mentor"
                >
                  <BookOpen className="w-4 h-4" aria-hidden />
                  طالب علم
                </button>
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, role: 'parent' }))}
                  aria-pressed={form.role === 'parent'}
                  className="auth-role tone-neutral"
                >
                  <Users className="w-4 h-4" aria-hidden />
                  ولي أمر
                </button>
              </div>
            </div>

            {/* Name row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-firstName" className="auth-label">الاسم الأول *</label>
                <input
                  id="reg-firstName" name="firstName" value={form.firstName} onChange={handleChange}
                  className="auth-input" placeholder="أحمد"
                  aria-invalid={Boolean(errors.firstName)}
                  aria-describedby={errors.firstName ? 'reg-firstName-error' : undefined}
                />
                <FieldError id="reg-firstName-error" message={errors.firstName} />
              </div>
              <div>
                <label htmlFor="reg-lastName" className="auth-label">اسم العائلة *</label>
                <input
                  id="reg-lastName" name="lastName" value={form.lastName} onChange={handleChange}
                  className="auth-input" placeholder="العمري"
                  aria-invalid={Boolean(errors.lastName)}
                  aria-describedby={errors.lastName ? 'reg-lastName-error' : undefined}
                />
                <FieldError id="reg-lastName-error" message={errors.lastName} />
              </div>
            </div>

            {/* Email (optional — for account recovery only) */}
            <div>
              <label htmlFor="reg-email" className="auth-label">البريد الإلكتروني <span style={{ color: '#756E85', fontWeight: 500 }}>(اختياري — لاستعادة الحساب)</span></label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#756E85]" aria-hidden />
                <input
                  id="reg-email" name="email" type="email" value={form.email} onChange={handleChange}
                  className="auth-input pr-10"
                  style={{ direction: 'ltr', textAlign: 'left' }}
                  placeholder="your@email.com"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'reg-email-error' : undefined}
                />
              </div>
              <FieldError id="reg-email-error" message={errors.email} />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="reg-password" className="auth-label">كلمة المرور *</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#756E85]" aria-hidden />
                <input
                  id="reg-password" name="password" type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={handleChange}
                  className="auth-input pr-10 pl-12"
                  style={{ direction: 'ltr', textAlign: 'left' }}
                  placeholder="6 أحرف على الأقل"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'reg-password-error' : undefined}
                />
                <button
                  type="button" onClick={() => setShowPass(!showPass)}
                  className="auth-iconbtn"
                  aria-label={showPass ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  aria-pressed={showPass}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <FieldError id="reg-password-error" message={errors.password} />
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="reg-confirm" className="auth-label">تأكيد كلمة المرور *</label>
              <input
                id="reg-confirm" name="confirmPassword" type="password" value={form.confirmPassword}
                onChange={handleChange}
                className="auth-input"
                style={{ direction: 'ltr', textAlign: 'left' }}
                placeholder="أعد كتابة كلمة المرور"
                aria-invalid={Boolean(errors.confirmPassword)}
                aria-describedby={errors.confirmPassword ? 'reg-confirm-error' : undefined}
              />
              <FieldError id="reg-confirm-error" message={errors.confirmPassword} />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="reg-phone" className="auth-label">رقم الهاتف * <span style={{ color: '#756E85', fontWeight: 500 }}>(للدخول — مصري)</span></label>
              <input
                id="reg-phone" name="phone" value={form.phone} onChange={handleChange}
                className="auth-input"
                style={{ direction: 'ltr', textAlign: 'left' }}
                placeholder="01xxxxxxxxx" inputMode="tel"
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? 'reg-phone-error' : undefined}
              />
              <FieldError id="reg-phone-error" message={errors.phone} />
            </div>

            {/* DOB & Gender */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-dob" className="auth-label">تاريخ الميلاد</label>
                <input
                  id="reg-dob" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange}
                  className="auth-input"
                  style={{ direction: 'ltr', textAlign: 'left' }}
                />
              </div>
              <div>
                <label htmlFor="reg-gender" className="auth-label">الجنس</label>
                <select id="reg-gender" name="gender" value={form.gender} onChange={handleChange} className="auth-input">
                  <option value="">اختر</option>
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="auth-btn" style={{ marginTop: 8 }}>
              {isLoading ? <LoadingSpinner size="sm" color="white" /> : 'إنشاء الحساب'}
            </button>

            <p className="text-center text-sm" style={{ color: '#756E85' }}>
              لديك حساب؟{' '}
              <Link to="/login" className="auth-link text-sm">
                تسجيل الدخول
              </Link>
            </p>
          </form>
        </motion.div>
      </div>
    </MotionConfig>
  );
}
