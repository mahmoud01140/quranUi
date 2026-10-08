import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Clock, CheckCircle2, ChevronLeft, AlertCircle,
  Phone, MessageSquare, Sparkles, BookOpen, User, ShieldCheck,
  Check, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import './Onboarding.css';

const DEFAULT_DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];

export default function StudentScheduleBookingPage() {
  const { user, refreshUser } = useAuthStore();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Settings from backend
  const [settings, setSettings] = useState({
    lectureDuration: 45,
    workStartTime: '09:00',
    workEndTime: '22:00',
    workingDays: DEFAULT_DAYS,
    customerServicePhone: '201012345678',
  });

  // Selection states
  const [selectedDays, setSelectedDays] = useState(['السبت', 'الثلاثاء']);
  const [inspectDay, setInspectDay] = useState('السبت');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedTime, setSelectedTime] = useState('');

  // Booking success result
  const [bookingSuccess, setBookingSuccess] = useState(null);

  // Load initial settings and slots
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/schedule/settings');
      if (res.data?.settings) {
        setSettings(res.data.settings);
        const days = res.data.settings.workingDays?.length ? res.data.settings.workingDays : DEFAULT_DAYS;
        if (days.length > 0) {
          const firstDay = days[0];
          setInspectDay(firstDay);
          setSelectedDays([firstDay]);
          await fetchSlotsForDay(firstDay);
        }
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      toast.error('تعذر جلب إعدادات المواعيد');
    } finally {
      setLoading(false);
    }
  };

  const fetchSlotsForDay = async (day) => {
    try {
      setSlotsLoading(true);
      const res = await api.get('/schedule/available-slots', { params: { day } });
      if (res.data?.slots) {
        setAvailableSlots(res.data.slots);
      }
    } catch (err) {
      console.error('Error fetching slots:', err);
      toast.error('خطأ في تحميل المواعيد المتاحة لهذا اليوم');
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleDayToggle = (day) => {
    let updated;
    if (selectedDays.includes(day)) {
      if (selectedDays.length === 1) {
        toast('يرجى اختيار يوم واحد على الأقل');
        return;
      }
      updated = selectedDays.filter((d) => d !== day);
    } else {
      updated = [...selectedDays, day];
    }
    setSelectedDays(updated);
    setInspectDay(day);
    fetchSlotsForDay(day);
  };

  const handleInspectDayChange = (day) => {
    setInspectDay(day);
    fetchSlotsForDay(day);
  };

  const handleConfirmBooking = async () => {
    if (!selectedDays || selectedDays.length === 0) {
      toast.error('يرجى تحديد أيام الحصص');
      return;
    }
    if (!selectedTime) {
      toast.error('يرجى اختيار موعد الحصة من المواعيد المتاحة');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/schedule/book', {
        days: selectedDays,
        sessionTime: selectedTime,
      });

      if (res.data?.success) {
        setBookingSuccess(res.data);
        await refreshUser();
        toast.success('تم حجز وتثبيت جدولك بنجاح! 🎉');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'تعذر حجز الموعد. يرجى تجربة موعد آخر.';
      toast.error(msg);
      // Re-fetch slots in case the selected slot was taken
      fetchSlotsForDay(inspectDay);
    } finally {
      setSubmitting(false);
    }
  };

  // Format 24h to friendly Arabic time (e.g. 05:00 م)
  const formatTimeAr = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'م' : 'ص';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  };

  if (loading) {
    return (
      <div className="onb flex items-center justify-center min-h-screen" dir="rtl">
        <LoadingSpinner size="lg" text="جارٍ تهيئة نظام الجدولة وحساب المواعيد المتاحة..." />
      </div>
    );
  }

  return (
    <div className="onb min-h-screen py-10 px-4" dir="rtl">
      <div className="max-w-3xl mx-auto">
        <AnimatePresence mode="wait">
          {!bookingSuccess ? (
            <motion.div
              key="booking-form"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Header */}
              <div className="text-center space-y-2">
                <span className="onb-badge inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#E2EFE7] text-[#0F5940]">
                  <Sparkles className="w-3.5 h-3.5" /> الخطوة الأخيرة: تثبيت جدولك الدراسي
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-[#2A2438]">
                  اختر المواعيد المناسبة لك
                </h1>
                <p className="text-sm sm:text-base text-[#756E85] max-w-lg mx-auto">
                  تم تحديد مستواك بنجاح! اختر الآن أيام دراستك والوقت الذي يناسبك من الفترات المتاحة بدون أي تداخل.
                </p>
              </div>

              {/* Step 1: Select Days */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#E8E2D4] space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#E2EFE7] flex items-center justify-center text-[#177B58] font-black text-sm">
                      1
                    </div>
                    <div>
                      <h2 className="font-bold text-[#2A2438] text-base">حدد أيام الحضور الأسبوعية</h2>
                      <p className="text-xs text-[#756E85]">اختر الأيام التي ترغب في أخذ حصتك فيها</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium bg-[#FBF7EE] text-[#756E85] px-3 py-1 rounded-lg border border-[#E8E2D4]">
                    تم اختيار: <strong className="text-[#177B58]">{selectedDays.length}</strong> أيام
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-2">
                  {(settings.workingDays || DEFAULT_DAYS).map((day) => {
                    const isSelected = selectedDays.includes(day);
                    const isInspecting = inspectDay === day;

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleDayToggle(day)}
                        className={`p-3 rounded-2xl text-center font-bold text-sm transition-all duration-200 border flex flex-col items-center justify-center gap-1.5 relative ${
                          isSelected
                            ? 'bg-[#177B58] text-white border-[#177B58] shadow-md shadow-[#177B58]/20'
                            : 'bg-[#FBF7EE] text-[#2A2438] border-[#E8E2D4] hover:border-[#177B58]/40 hover:bg-white'
                        }`}
                      >
                        <Calendar className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-[#756E85]'}`} />
                        <span>{day}</span>
                        {isSelected && (
                          <span className="w-4 h-4 rounded-full bg-white text-[#177B58] flex items-center justify-center text-[10px]">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Time Slots for Inspected Day */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#E8E2D4] space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#E2EFE7] flex items-center justify-center text-[#177B58] font-black text-sm">
                      2
                    </div>
                    <div>
                      <h2 className="font-bold text-[#2A2438] text-base">اختر توقيت الحصة المناسب</h2>
                      <p className="text-xs text-[#756E85]">
                        مدة المحاضرة: <strong className="text-[#177B58]">{settings.lectureDuration} دقيقة</strong> | ساعات العمل: من {formatTimeAr(settings.workStartTime)} إلى {formatTimeAr(settings.workEndTime)}
                      </p>
                    </div>
                  </div>

                  {/* Day switcher if multiple days selected */}
                  {selectedDays.length > 1 && (
                    <div className="flex items-center gap-1 bg-[#FBF7EE] p-1 rounded-xl border border-[#E8E2D4] text-xs">
                      <span className="text-[#756E85] px-2">معاينة يوم:</span>
                      {selectedDays.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => handleInspectDayChange(d)}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                            inspectDay === d ? 'bg-[#177B58] text-white shadow-xs' : 'text-[#2A2438] hover:bg-white'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {slotsLoading ? (
                  <div className="py-12 flex justify-center">
                    <LoadingSpinner size="md" text={`جارٍ فحص المواعيد المتاحة ليوم ${inspectDay}...`} />
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="py-8 text-center text-[#756E85] bg-[#FBF7EE] rounded-2xl border border-dashed border-[#E8E2D4]">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-[#C2410C] opacity-70" />
                    <p className="font-bold text-[#2A2438]">لا توجد فترات عمل متاحة في هذا اليوم</p>
                    <p className="text-xs mt-1">يرجى مراجعة إدارة الأكاديمية أو اختيار يوم آخر</p>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-4 text-xs text-[#756E85] px-1">
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-[#E2EFE7] border border-[#177B58]" /> متاح للحجز
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-[#F3F4F6] border border-[#D1D5DB]" /> محجوز مسبقاً
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[360px] overflow-y-auto p-1">
                      {availableSlots.map((slot) => {
                        const isChosen = selectedTime === slot.start;
                        const isAvailable = slot.isAvailable;

                        return (
                          <button
                            key={slot.start}
                            type="button"
                            disabled={!isAvailable}
                            onClick={() => setSelectedTime(slot.start)}
                            className={`p-3 rounded-2xl text-center transition-all duration-200 border flex flex-col items-center justify-center gap-1 relative ${
                              isChosen
                                ? 'bg-[#177B58] text-white border-[#177B58] shadow-md shadow-[#177B58]/30 scale-[1.02]'
                                : isAvailable
                                ? 'bg-white text-[#2A2438] border-[#E8E2D4] hover:border-[#177B58] hover:bg-[#E2EFE7]/30'
                                : 'bg-[#F9FAFB] text-[#9CA3AF] border-[#E5E7EB] opacity-60 cursor-not-allowed'
                            }`}
                          >
                            <span className="font-extrabold text-sm sm:text-base tracking-wide" dir="ltr">
                              {formatTimeAr(slot.start)}
                            </span>
                            <span className={`text-[11px] font-medium ${isChosen ? 'text-white/90' : isAvailable ? 'text-[#177B58]' : 'text-gray-400'}`}>
                              {isChosen ? 'تم الاختيار' : isAvailable ? `${slot.duration} دقيقة` : 'محجوز'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Selected Summary Bar & Confirm Button */}
              <div className="bg-[#E2EFE7] rounded-3xl p-5 border border-[#177B58]/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-right">
                  <p className="text-xs font-bold text-[#0F5940]">ملخص اختيارك:</p>
                  <p className="text-sm font-extrabold text-[#2A2438]">
                    الأيام: <span className="text-[#177B58]">{selectedDays.join('، ') || 'لم تحدد'}</span>
                    {' '}| التوقيت:{' '}
                    <span className="text-[#177B58]">
                      {selectedTime ? formatTimeAr(selectedTime) : 'يرجى اختيار وقت'}
                    </span>
                  </p>
                </div>

                <button
                  type="button"
                  disabled={submitting || !selectedTime || selectedDays.length === 0}
                  onClick={handleConfirmBooking}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-[#177B58] text-white font-black text-base shadow-lg shadow-[#177B58]/30 hover:bg-[#0F5940] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <LoadingSpinner size="sm" color="white" text="جارٍ تثبيت الموعد..." />
                  ) : (
                    <>
                      <span>تأكيد الموعد النهائي</span>
                      <ChevronLeft className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          ) : (
            /* Booking Success View with WhatsApp Redirection */
            <motion.div
              key="booking-success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="bg-white rounded-3xl p-6 sm:p-10 shadow-xl border border-[#E8E2D4] text-center space-y-6"
            >
              {/* Checkmark Animation Icon */}
              <div className="w-20 h-20 rounded-full bg-[#E2EFE7] text-[#177B58] mx-auto flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
              </div>

              <div className="space-y-2">
                <span className="inline-block px-4 py-1.5 rounded-full text-xs font-black bg-[#E2EFE7] text-[#0F5940]">
                  تم الحجز والتثبيت بنجاح 🎉
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-[#2A2438]">
                  مبارك! تم اعتماد موعد جدولك الدراسي
                </h1>
                <p className="text-sm text-[#756E85] max-w-md mx-auto">
                  تم حجز أوقاتك دون أي تعارض، يرجى الآن التواصل مع خدمة العملاء عبر الواتساب لتأكيد بدء أول حصة مباشرة.
                </p>
              </div>

              {/* Schedule Card Details */}
              <div className="bg-[#FBF7EE] rounded-2xl p-5 border border-[#E8E2D4] max-w-md mx-auto text-right space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-[#E8E2D4]">
                  <span className="text-xs text-[#756E85]">اسم الطالب</span>
                  <span className="font-bold text-sm text-[#2A2438]">
                    {user?.firstName} {user?.lastName}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-3 border-b border-[#E8E2D4]">
                  <span className="text-xs text-[#756E85]">أيام الحصص المعتمدة</span>
                  <span className="font-bold text-sm text-[#177B58]">
                    {bookingSuccess.booking?.days?.join('، ')}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-3 border-b border-[#E8E2D4]">
                  <span className="text-xs text-[#756E85]">توقيت المحاضرة</span>
                  <span className="font-bold text-sm text-[#177B58]" dir="ltr">
                    {formatTimeAr(bookingSuccess.booking?.sessionTime)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#756E85]">رقم خدمة العملاء المعتمد</span>
                  <span className="font-bold text-sm text-[#2A2438] flex items-center gap-1.5" dir="ltr">
                    <Phone className="w-3.5 h-3.5 text-[#177B58]" />
                    +{bookingSuccess.customerServicePhone || settings.customerServicePhone}
                  </span>
                </div>
              </div>

              {/* WhatsApp Redirection Button */}
              <div className="space-y-3 max-w-md mx-auto pt-2">
                <a
                  href={bookingSuccess.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-4 px-6 rounded-2xl bg-[#25D366] hover:bg-[#1EBE5D] text-white font-black text-base shadow-lg shadow-[#25D366]/30 transition-all flex items-center justify-center gap-3 transform hover:-translate-y-0.5"
                >
                  <MessageSquare className="w-6 h-6 fill-white" />
                  <span>تأكيد الموعد عبر واتساب الآن</span>
                </a>
                <p className="text-xs text-[#756E85]">
                  عند الضغط، سيفتح تطبيق واتساب برسالة جاهزة بتفاصيل موعدك لإرسالها فوراً لخدمة العملاء.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-[#E8E2D4] flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
                <button
                  type="button"
                  onClick={() => navigate('/student')}
                  className="w-full py-3 px-5 rounded-xl bg-[#2A2438] text-white font-bold text-sm hover:bg-[#1E1928] transition-colors flex items-center justify-center gap-2"
                >
                  <User className="w-4 h-4" />
                  <span>الدخول للوحة التحكم الخاصة بك</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/student/quran')}
                  className="w-full py-3 px-5 rounded-xl bg-white border border-[#E8E2D4] text-[#2A2438] font-bold text-sm hover:bg-[#FBF7EE] transition-colors flex items-center justify-center gap-2"
                >
                  <BookOpen className="w-4 h-4 text-[#177B58]" />
                  <span>تصفح المصحف الشريف</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
