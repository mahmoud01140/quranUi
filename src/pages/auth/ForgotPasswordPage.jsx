import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, MotionConfig } from 'framer-motion';
import { Mail, BookOpen, ArrowRight, CircleCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import './Auth.css';

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [sentMessage, setSentMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      toast.error('رقم الهاتف أو البريد الإلكتروني مطلوب');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', {
        identifier: identifier.trim(),
        email: identifier.trim(),
      });
      setSentMessage(res.data?.message || '');
      setIsSent(true);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'حدث خطأ، حاول مجدداً');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="auth" dir="rtl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
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
            <h1 className="text-2xl font-extrabold" style={{ color: '#2A2438' }}>نسيت كلمة المرور</h1>
            <p className="mt-1" style={{ color: '#756E85' }}>أدخل رقم هاتفك أو بريدك الإلكتروني</p>
          </div>

          {isSent ? (
            <div className="auth-card text-center">
              <span
                aria-hidden
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: '#E2EFE7' }}
              >
                <CircleCheck className="w-8 h-8" style={{ color: '#177B58' }} />
              </span>
              <h2 className="text-lg font-extrabold mb-2" style={{ color: '#2A2438' }}>تم!</h2>
              <p className="text-sm mb-6" style={{ color: '#756E85' }}>
                {sentMessage || 'إذا كان البريد الإلكتروني مسجلاً لدينا، ستتلقى رابط إعادة تعيين كلمة المرور خلال دقائق.'}
              </p>
              <Link to="/login" className="auth-btn auth-btn-auto px-6">
                العودة لتسجيل الدخول
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="auth-card space-y-5">
              <div>
                <label htmlFor="forgot-identifier" className="auth-label">رقم الهاتف أو البريد الإلكتروني</label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#756E85]" aria-hidden />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="auth-input pr-10"
                    style={{ direction: 'ltr', textAlign: 'left' }}
                    placeholder="01xxxxxxxxx"
                    id="forgot-identifier"
                  />
                </div>
                <p className="text-xs mt-2" style={{ color: '#756E85' }}>
                  مسجل برقم الهاتف فقط؟ تواصل مع الإدارة لتعيين كلمة مرور جديدة لك.
                </p>
              </div>

              <button type="submit" disabled={isLoading} className="auth-btn">
                {isLoading ? <LoadingSpinner size="sm" color="white" /> : 'متابعة'}
              </button>

              <p className="text-center text-sm pt-1" style={{ color: '#756E85' }}>
                تتذكر كلمة المرور؟{' '}
                <Link to="/login" className="auth-link text-sm">
                  تسجيل الدخول
                </Link>
              </p>
            </form>
          )}

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
