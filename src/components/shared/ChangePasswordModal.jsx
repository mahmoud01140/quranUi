import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Eye, EyeOff, KeyRound, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function ChangePasswordModal({ isOpen, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  if (!isOpen) return null;

  const validate = () => {
    const errs = {};
    if (!newPassword) {
      errs.newPassword = 'كلمة المرور الجديدة مطلوبة';
    } else if (newPassword.length < 6) {
      errs.newPassword = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
    }

    if (!confirmPassword) {
      errs.confirmPassword = 'يرجى تأكيد كلمة المرور';
    } else if (newPassword !== confirmPassword) {
      errs.confirmPassword = 'كلمتا المرور غير متطابقتين';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        newPassword,
        ...(currentPassword ? { currentPassword } : {}),
      };

      const res = await api.put('/auth/change-password', payload);
      toast.success(res.data?.message || 'تم تغيير كلمة المرور بنجاح');
      handleClose();
    } catch (err) {
      const msg = err.response?.data?.message || 'فشل تغيير كلمة المرور';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrors({});
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-[#E8E2D4]"
          dir="rtl"
        >
          {/* Header */}
          <div className="relative px-6 py-5 bg-gradient-to-r from-[#177B58] to-[#0F5940] text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white backdrop-blur-sm shadow-inner">
                <KeyRound className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h3 className="text-lg font-bold">تغيير كلمة المرور</h3>
                <p className="text-xs text-white/80">تحديث كلمة مرور حسابك لتأمين الدخول</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="absolute left-4 top-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Current Password (Optional if admin) */}
            <div>
              <label className="block text-xs font-bold text-[#2A2438] mb-1.5">
                كلمة المرور الحالية <span className="text-[#756E85] font-normal">(اختيارية للمدير)</span>
              </label>
              <div className="relative">
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#756E85]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور الحالية إن وُجدت"
                  className="w-full pr-10 pl-10 py-2.5 rounded-xl border border-[#E8E2D4] bg-[#FAF7F2] text-sm text-[#2A2438] focus:outline-none focus:border-[#177B58] focus:bg-white transition-all placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#756E85] hover:text-[#177B58] transition-colors"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-bold text-[#2A2438] mb-1.5">
                كلمة المرور الجديدة <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#756E85]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (errors.newPassword) setErrors({ ...errors, newPassword: null });
                  }}
                  placeholder="6 أحرف أو أرقام على الأقل"
                  className={`w-full pr-10 pl-10 py-2.5 rounded-xl border text-sm text-[#2A2438] focus:outline-none focus:bg-white transition-all placeholder:text-gray-400 ${
                    errors.newPassword
                      ? 'border-red-400 bg-red-50/30 focus:border-red-500'
                      : 'border-[#E8E2D4] bg-[#FAF7F2] focus:border-[#177B58]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#756E85] hover:text-[#177B58] transition-colors"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-xs text-red-500 mt-1 font-medium">{errors.newPassword}</p>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-bold text-[#2A2438] mb-1.5">
                تأكيد كلمة المرور الجديدة <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#756E85]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: null });
                  }}
                  placeholder="أعد إدخال كلمة المرور الجديدة"
                  className={`w-full pr-10 pl-10 py-2.5 rounded-xl border text-sm text-[#2A2438] focus:outline-none focus:bg-white transition-all placeholder:text-gray-400 ${
                    errors.confirmPassword
                      ? 'border-red-400 bg-red-50/30 focus:border-red-500'
                      : 'border-[#E8E2D4] bg-[#FAF7F2] focus:border-[#177B58]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#756E85] hover:text-[#177B58] transition-colors"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-red-500 mt-1 font-medium">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#177B58] hover:bg-[#0F5940] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    حفظ كلمة المرور
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="py-2.5 px-4 rounded-xl border border-[#E8E2D4] text-[#756E85] hover:bg-[#FAF7F2] font-semibold text-sm transition-colors"
              >
                إلغاء
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
