import { useState, useEffect } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import {
  CreditCard, CheckCircle2, AlertCircle, Clock, Search, Filter,
  Eye, Check, X, Settings, RefreshCw, Smartphone, Building2,
  DollarSign, Users, ShieldAlert, ArrowUpRight, Phone, MessageSquare,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageLayout from '../../components/shared/PageLayout';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import Pagination from '../../components/shared/Pagination';
import '../../components/halaqa/halaqa.css';
import { HQ, HqBadge } from '../../components/halaqa/primitives';
import api from '../../services/api';
import { formatDateAr, getInitials, getAvatarColor } from '../../utils/helpers';

/* Payments desk — requests, receipts and account settings.
   Same tabs, filters, modals and payloads as before; visual only. */

const field = {
  width: '100%', minHeight: 48, background: HQ.SURFACE, color: HQ.INK,
  border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: '12px 16px',
  fontSize: 14, fontFamily: 'inherit',
};

export default function AdminPaymentsPage() {
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'settings'

  // Data states
  const [isLoading, setIsLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
  });

  // Filter states
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState(null);
  const [approveModalPayment, setApproveModalPayment] = useState(null);
  const [rejectModalPayment, setRejectModalPayment] = useState(null);
  const [customDays, setCustomDays] = useState(30);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Settings states — start EMPTY so placeholder-looking values can never
  // be saved as real payment destinations if the fetch fails.
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsFailed, setSettingsFailed] = useState(false);
  const [settings, setSettings] = useState({
    vodafoneCashNumbers: [],
    vodafoneInstructions: '',
    vodafoneEnabled: true,
    instaPayAddress: '',
    instaPayPhone: '',
    instaPayAccountName: '',
    instaPayInstructions: '',
    instaPayEnabled: true,
    plan: {
      name: 'الاشتراك الشهري في حلقات القرآن الكريم',
      description: 'اشتراك شهري شامل لحضور كافة الحلقات المباشرة ومتابعة خطة الحفظ',
      priceEGP: '',
      quarterlyDiscountPercent: 10,
      annualDiscountPercent: 20,
    },
    freeTrialSessionsCount: 1,
    reminderDaysBeforeExpiry: 3,
    supportPhone: '',
    supportWhatsapp: '',
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, methodFilter, searchQuery]);

  useEffect(() => {
    fetchPayments();
  }, [statusFilter, methodFilter, currentPage, pageSize]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/payments/admin/all', {
        params: {
          status: statusFilter,
          method: methodFilter,
          search: searchQuery,
          page: currentPage,
          limit: pageSize,
        },
      });

      if (res.data) {
        setPayments(res.data.payments || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        } else {
          setPagination({
            total: res.data.payments?.length || 0,
            page: 1,
            pages: 1,
          });
        }
        setStats(res.data.stats || {
          totalRevenue: 0,
          pendingCount: 0,
          approvedCount: 0,
          rejectedCount: 0,
        });
      }
    } catch (err) {
      console.error('Error fetching payments:', err);
      toast.error('حدث خطأ أثناء جلب طلبات الدفع');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      setSettingsFailed(false);
      const res = await api.get('/payments/admin/settings');
      if (res.data?.settings) {
        setSettings(res.data.settings);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      setSettingsFailed(true);
    }
  };

  const handleApprove = async () => {
    if (!approveModalPayment) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/payments/admin/${approveModalPayment._id}/approve`, {
        customDurationDays: customDays,
      });

      toast.success(res.data?.message || 'تم اعتماد الدفعة وتفعيل الاشتراك بنجاح!');
      setApproveModalPayment(null);
      await fetchPayments();
    } catch (err) {
      console.error('Approve error:', err);
      toast.error(err.response?.data?.message || 'خطأ في اعتماد الدفعة');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModalPayment) return;
    if (!rejectReason.trim()) {
      toast.error('يرجى ذكر سبب الرفض لتوضيحه للطالب');
      return;
    }

    setActionLoading(true);
    try {
      const res = await api.post(`/payments/admin/${rejectModalPayment._id}/reject`, {
        reason: rejectReason,
      });

      toast.success(res.data?.message || 'تم رفض طلب الدفع وإشعار الطالب');
      setRejectModalPayment(null);
      setRejectReason('');
      await fetchPayments();
    } catch (err) {
      console.error('Reject error:', err);
      toast.error(err.response?.data?.message || 'خطأ في رفض الدفعة');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    // Never save placeholder-looking payment data: prices and at least one
    // enabled payment destination are required.
    const priceEGP = Number(settings.plan?.priceEGP);
    if (!priceEGP) {
      toast.error('حدد سعر الاشتراك بالجنيه المصري قبل الحفظ');
      return;
    }
    const vodaOk = (settings.vodafoneCashNumbers || []).filter(Boolean).length > 0;
    const instaOk = Boolean((settings.instaPayAddress || '').trim());
    if (!vodaOk && !instaOk) {
      toast.error('أدخل رقم فودافون كاش أو عنوان انستاباي قبل الحفظ');
      return;
    }
    setSettingsLoading(true);
    try {
      const res = await api.put('/payments/admin/settings', settings);
      toast.success(res.data?.message || 'تم تحديث إعدادات الدفع بنجاح!');
    } catch (err) {
      console.error('Save settings error:', err);
      toast.error('حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setSettingsLoading(false);
    }
  };

  const filteredPayments = payments.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const studentName = `${p.user?.firstName || ''} ${p.user?.lastName || ''}`.toLowerCase();
    const email = (p.user?.email || '').toLowerCase();
    const ref = (p.referenceNumber || '').toLowerCase();
    const phone = (p.senderPhone || '').toLowerCase();
    return studentName.includes(q) || email.includes(q) || ref.includes(q) || phone.includes(q);
  });

  const panel = {
    background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 20,
  };
  const lbl = { fontSize: 14, fontWeight: 700, color: HQ.INK, marginBottom: 6, display: 'block' };
  const lblSm = { fontSize: '0.8125rem', fontWeight: 700, color: HQ.INK, marginBottom: 6, display: 'block' };
  const primaryBtn = {
    minHeight: 48, padding: '12px 20px', borderRadius: 12, border: 'none',
    background: HQ.MENTOR, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  };
  const iconBtn = {
    minWidth: 44, minHeight: 44, borderRadius: 12, border: `1px solid ${HQ.LINE}`, background: HQ.SURFACE,
    color: HQ.MUTED, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };

  const statusChip = (status) => {
    if (status === 'approved') return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', fontWeight: 800,
        background: '#E2EFE7', color: '#0F5940', borderRadius: 9999, padding: '4px 12px',
      }}>
        <CheckCircle2 size={14} aria-hidden />
        معتمد ومفعل
      </span>
    );
    if (status === 'rejected') return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', fontWeight: 800,
        background: HQ.SURFACE, color: '#C2410C', border: '1px solid #C2410C', borderRadius: 9999, padding: '4px 12px',
      }}>
        <AlertCircle size={14} aria-hidden />
        مرفوض
      </span>
    );
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', fontWeight: 800,
        background: HQ.PAPER, color: '#B45309', border: '1px solid #B45309', borderRadius: 9999, padding: '4px 12px',
      }}>
        <Clock size={14} aria-hidden />
        قيد المراجعة
      </span>
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <PageLayout>
        <div className="halaqa" style={{ maxWidth: 1040, margin: '0 auto' }}>
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <HqBadge tone="mentor">إدارة النظام والمالية</HqBadge>
                <HqBadge tone="neutral">فودافون كاش وانستاباي</HqBadge>
              </div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: HQ.INK, margin: '0 0 4px' }}>
                إدارة المدفوعات والاشتراكات
              </h1>
              <p className="text-sm" style={{ color: HQ.MUTED, margin: 0 }}>
                مراجعة إيصالات التحويل، تفعيل باقات الطلاب، وضبط بيانات محافظ فودافون كاش وحسابات انستاباي
              </p>
            </div>

            {/* Tab navigation */}
            <div className="hq-tabs" role="tablist" aria-label="أقسام المدفوعات" style={{ alignSelf: 'flex-start' }}>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'requests'}
                onClick={() => setActiveTab('requests')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
              >
                <CreditCard size={15} aria-hidden />
                طلبات التحويل ({stats.pendingCount > 0 ? `${stats.pendingCount} معلق` : payments.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'settings'}
                onClick={() => setActiveTab('settings')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
              >
                <Settings size={15} aria-hidden />
                إعدادات الحسابات والأسعار
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8" aria-label="ملخص المدفوعات">
            <div className="flex items-center gap-4 p-5" style={panel}>
              <span aria-hidden style={{
                width: 48, height: 48, borderRadius: 14, background: '#E2EFE7', color: HQ.MENTOR,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
              }}>
                <DollarSign size={23} />
              </span>
              <span>
                <span className="block font-extrabold" style={{ fontSize: '1.5rem', color: HQ.INK, fontVariantNumeric: 'tabular-nums' }}>
                  {stats.totalRevenue.toLocaleString()} <span className="font-normal" style={{ fontSize: '0.8125rem', color: HQ.MUTED }}>ج.م</span>
                </span>
                <span className="block text-xs font-bold" style={{ color: HQ.MUTED }}>إجمالي المبيعات المعتمدة</span>
              </span>
            </div>

            <div className="flex items-center gap-4 p-5 relative" style={panel}>
              {stats.pendingCount > 0 && (
                <span aria-hidden style={{ position: 'absolute', top: 12, left: 12, width: 10, height: 10, borderRadius: 9999, background: '#B45309' }} />
              )}
              <span aria-hidden style={{
                width: 48, height: 48, borderRadius: 14, background: HQ.PAPER, color: '#B45309',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
              }}>
                <Clock size={23} />
              </span>
              <span>
                <span className="block font-extrabold" style={{ fontSize: '1.5rem', color: '#B45309', fontVariantNumeric: 'tabular-nums' }}>{stats.pendingCount}</span>
                <span className="block text-xs font-bold" style={{ color: HQ.MUTED }}>طلبات بانتظار المراجعة</span>
              </span>
            </div>

            <div className="flex items-center gap-4 p-5" style={panel}>
              <span aria-hidden style={{
                width: 48, height: 48, borderRadius: 14, background: '#E2EFE7', color: HQ.MENTOR,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
              }}>
                <CheckCircle2 size={23} />
              </span>
              <span>
                <span className="block font-extrabold" style={{ fontSize: '1.5rem', color: HQ.MENTOR, fontVariantNumeric: 'tabular-nums' }}>{stats.approvedCount}</span>
                <span className="block text-xs font-bold" style={{ color: HQ.MUTED }}>اشتراكات مفعلة</span>
              </span>
            </div>

            <div className="flex items-center gap-4 p-5" style={panel}>
              <span aria-hidden style={{
                width: 48, height: 48, borderRadius: 14, background: HQ.PAPER, color: '#C2410C',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
              }}>
                <AlertCircle size={23} />
              </span>
              <span>
                <span className="block font-extrabold" style={{ fontSize: '1.5rem', color: '#C2410C', fontVariantNumeric: 'tabular-nums' }}>{stats.rejectedCount}</span>
                <span className="block text-xs font-bold" style={{ color: HQ.MUTED }}>طلبات مرفوضة</span>
              </span>
            </div>
          </div>

          {/* TAB 1: REQUESTS & TRANSACTIONS */}
          {activeTab === 'requests' && (
            <div className="space-y-6">

              {/* Filters & Search */}
              <div className="p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4" style={panel}>
                <div className="relative w-full md:w-80">
                  <Search size={15} color={HQ.MUTED} aria-hidden className="absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="بحث في طلبات الدفع"
                    placeholder="بحث باسم الطالب، الإيميل، رقم المحفظة..."
                    className="w-full text-sm pr-10 focus:border-[#177B58] focus:outline-none"
                    style={field}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <div className="flex items-center gap-1 p-1 text-xs font-bold" role="group" aria-label="تصفية حسب الحالة"
                    style={{ background: HQ.PAPER, borderRadius: 12 }}>
                    {[
                      { id: 'all', label: 'الكل' },
                      { id: 'pending', label: `بانتظار المراجعة (${stats.pendingCount})` },
                      { id: 'approved', label: 'المعتمدة' },
                      { id: 'rejected', label: 'المرفوضة' },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setStatusFilter(st.id)}
                        aria-pressed={statusFilter === st.id}
                        className="px-3 rounded-lg"
                        style={{
                          minHeight: 44, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.8125rem',
                          background: statusFilter === st.id ? HQ.MENTOR : 'transparent',
                          color: statusFilter === st.id ? '#fff' : HQ.MUTED, fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 p-1 text-xs font-bold" role="group" aria-label="تصفية حسب الطريقة"
                    style={{ background: HQ.PAPER, borderRadius: 12 }}>
                    {[
                      { id: 'all', label: 'جميع الطرق' },
                      { id: 'vodafone_cash', label: 'فودافون كاش' },
                      { id: 'instapay', label: 'انستاباي' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMethodFilter(m.id)}
                        aria-pressed={methodFilter === m.id}
                        className="px-3 rounded-lg"
                        style={{
                          minHeight: 44, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.8125rem',
                          background: methodFilter === m.id ? HQ.MENTOR : 'transparent',
                          color: methodFilter === m.id ? '#fff' : HQ.MUTED,
                        }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={fetchPayments}
                    disabled={isLoading}
                    aria-label="تحديث القائمة"
                    style={iconBtn}
                  >
                    <RefreshCw size={16} aria-hidden className={isLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {/* Table */}
              <div style={{ ...panel, padding: 0, overflow: 'hidden' }}>
                {isLoading ? (
                  <div className="py-20 flex justify-center">
                    <LoadingSpinner size="lg" text="جارٍ جلب طلبات الدفع..." />
                  </div>
                ) : filteredPayments.length === 0 ? (
                  <div className="text-center py-16" style={{ color: HQ.MUTED }}>
                    <CreditCard size={46} color={HQ.LINE} style={{ margin: '0 auto 8px' }} aria-hidden />
                    <p className="font-bold text-sm" style={{ color: HQ.INK, margin: 0 }}>لا توجد طلبات تطابق الفلتر المختار</p>
                  </div>
                ) : (
                  <div className="hq-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                    <table className="hq-table">
                      <thead>
                        <tr>
                          <th>الطالب</th>
                          <th>الباقة والمدة</th>
                          <th>المبلغ</th>
                          <th>طريقة التحويل</th>
                          <th>بيانات المحول</th>
                          <th>إيصال التحويل</th>
                          <th>الحالة</th>
                          <th style={{ textAlign: 'center' }}>الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPayments.map((payment) => {
                          const isVodafone = payment.method === 'vodafone_cash';
                          const userName = `${payment.user?.firstName || ''} ${payment.user?.lastName || ''}`.trim() || 'طالب';

                          return (
                            <tr key={payment._id}>
                              <td data-label="الطالب">
                                <div className="flex items-center gap-3">
                                  <span aria-hidden className="avatar-circle"
                                    style={{
                                      width: 40, height: 40, fontSize: 14, flex: 'none',
                                      backgroundColor: getAvatarColor(userName),
                                    }}>
                                    {getInitials(payment.user?.firstName, payment.user?.lastName)}
                                  </span>
                                  <span>
                                    <span className="font-bold text-sm" style={{ color: HQ.INK, display: 'block' }}>{userName}</span>
                                    <span className="text-xs" style={{ color: HQ.MUTED, display: 'block' }}>{payment.user?.email || '—'}</span>
                                  </span>
                                </div>
                              </td>

                              <td data-label="الباقة والمدة">
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', padding: '4px 12px', borderRadius: 9999,
                                  fontSize: '0.8125rem', fontWeight: 800, background: HQ.PAPER, color: HQ.INK,
                                  border: `1px solid ${HQ.LINE}`,
                                }}>
                                  الاشتراك الموحد
                                </span>
                                <span className="text-xs block mt-1" style={{ color: HQ.MUTED }}>
                                  {payment.billingCycle === 'annual' ? 'اشتراك سنوي (365 يوم)'
                                    : payment.billingCycle === 'quarterly' ? '3 شهور (90 يوم)'
                                    : 'شهري (30 يوم)'}
                                </span>
                              </td>

                              <td data-label="المبلغ" className="font-black" style={{ color: HQ.INK, fontVariantNumeric: 'tabular-nums' }}>
                                {payment.amount} ج.م
                              </td>

                              <td data-label="طريقة التحويل">
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 9999,
                                  fontSize: '0.8125rem', fontWeight: 800, background: HQ.PAPER, color: HQ.INK,
                                  border: `1px solid ${HQ.LINE}`,
                                }}>
                                  {isVodafone
                                    ? <><Smartphone size={13} aria-hidden /> فودافون كاش</>
                                    : <><Building2 size={13} aria-hidden /> انستاباي</>}
                                </span>
                              </td>

                              <td data-label="بيانات المحول" className="text-xs">
                                <p className="font-bold" style={{ color: HQ.INK, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                                  {payment.senderPhone || payment.senderName || '—'}
                                </p>
                                {payment.referenceNumber && (
                                  <p className="mt-0.5" style={{ fontSize: '0.8125rem', color: HQ.MUTED, fontVariantNumeric: 'tabular-nums', margin: 0 }}>
                                    مرجع: {payment.referenceNumber}
                                  </p>
                                )}
                              </td>

                              <td data-label="إيصال التحويل">
                                {payment.receiptUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewReceiptUrl(payment.receiptUrl)}
                                    className="font-bold"
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44,
                                      padding: '8px 14px', borderRadius: 12, cursor: 'pointer',
                                      background: HQ.SURFACE, color: HQ.MENTOR, border: `1.5px solid ${HQ.MENTOR}`,
                                      fontSize: '0.8125rem',
                                    }}
                                  >
                                    <Eye size={14} aria-hidden />
                                    معاينة الإيصال
                                  </button>
                                ) : (
                                  <span className="text-xs" style={{ color: HQ.MUTED }} title="حُذفت صورة الإيصال تلقائياً لتوفير المساحة بعد مرور مدة المراجعة">حُذفت تلقائياً 🧹</span>
                                )}
                              </td>

                              <td data-label="الحالة">
                                {statusChip(payment.status)}
                                {payment.status === 'rejected' && payment.rejectionReason && (
                                  <p className="mt-1 truncate" title={payment.rejectionReason}
                                    style={{ fontSize: '0.8125rem', color: '#C2410C', maxWidth: 160, margin: 0 }}>
                                    {payment.rejectionReason}
                                  </p>
                                )}
                              </td>

                              <td data-label="الإجراءات" className="text-center m-actions">
                                {payment.status === 'pending' ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setApproveModalPayment(payment);
                                        setCustomDays(payment.activationDurationDays || 30);
                                      }}
                                      className="font-bold"
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44,
                                        padding: '8px 14px', borderRadius: 12, cursor: 'pointer',
                                        background: HQ.MENTOR, color: '#fff', border: 'none', fontSize: '0.8125rem',
                                      }}
                                      title="اعتماد وتفعيل الاشتراك"
                                    >
                                      <Check size={14} aria-hidden />
                                      قبول
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRejectModalPayment(payment);
                                        setRejectReason('');
                                      }}
                                      className="font-bold"
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44,
                                        padding: '8px 14px', borderRadius: 12, cursor: 'pointer',
                                        background: HQ.SURFACE, color: '#C2410C', border: '1px solid #C2410C',
                                        fontSize: '0.8125rem',
                                      }}
                                      title="رفض الطلب"
                                    >
                                      <X size={14} aria-hidden />
                                      رفض
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs" style={{ color: HQ.MUTED }}>
                                    تمت المراجعة بواسطة {payment.reviewedBy?.firstName || 'المسؤول'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <Pagination
                  currentPage={pagination.page || currentPage}
                  totalPages={pagination.pages || 1}
                  totalItems={pagination.total || 0}
                  pageSize={pageSize}
                  onPageChange={(p) => setCurrentPage(p)}
                  onPageSizeChange={(s) => {
                    setPageSize(s);
                    setCurrentPage(1);
                  }}
                  showPageSize={true}
                  pageSizeOptions={[10, 15, 30, 50]}
                  itemName="طلب سداد"
                  className="p-4"
                />
              </div>

            </div>
          )}

          {/* TAB 2: PAYMENT SETTINGS */}
          {activeTab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="space-y-8">
              {settingsFailed && (
                <div role="alert" style={{ background: HQ.SURFACE, border: '1px solid #C2410C', borderRadius: 14, padding: 16, fontSize: 14, color: '#C2410C', fontWeight: 700 }}>
                  تعذر تحميل الإعدادات الحالية — الحقول فارغة عمداً حتى لا تُحفظ قيم وهمية. أعد تحميل الصفحة قبل الحفظ.
                </div>
              )}

              {/* Vodafone Cash Configuration Card */}
              <div style={panel}>
                <div className="flex items-center gap-3 pb-4 mb-6" style={{ borderBottom: `1px solid ${HQ.LINE}` }}>
                  <span aria-hidden style={{
                    width: 40, height: 40, borderRadius: 14, background: '#E2EFE7', color: HQ.MENTOR,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
                  }}>
                    <Smartphone size={19} />
                  </span>
                  <div>
                    <h2 className="font-extrabold" style={{ fontSize: '1.25rem', color: HQ.INK, margin: 0 }}>إعدادات فودافون كاش (Vodafone Cash)</h2>
                    <p className="text-xs mt-0.5" style={{ color: HQ.MUTED, margin: 0 }}>تحديد أرقام المحافظ المعتمدة للتحويل والتعليمات المعروضة للطلاب</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="pay-voda-nums" style={lblSm}>
                      أرقام فودافون كاش (مفصولة بفاصلة إن وجد أكثر من رقم) *
                    </label>
                    <input
                      id="pay-voda-nums"
                      type="text"
                      required
                      value={Array.isArray(settings.vodafoneCashNumbers) ? settings.vodafoneCashNumbers.join(', ') : settings.vodafoneCashNumbers}
                      onChange={(e) => setSettings({ ...settings, vodafoneCashNumbers: e.target.value.split(',').map(s => s.trim()) })}
                      placeholder="01012345678, 01098765432"
                      className="focus:border-[#177B58] focus:outline-none"
                      style={{ ...field, fontVariantNumeric: 'tabular-nums' }}
                    />
                  </div>

                  <div>
                    <label style={lblSm}>حالة فودافون كاش</label>
                    <div className="flex items-center gap-4 mt-3">
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-bold" style={{ color: HQ.INK, minHeight: 48 }}>
                        <input
                          type="checkbox"
                          checked={settings.vodafoneEnabled}
                          onChange={(e) => setSettings({ ...settings, vodafoneEnabled: e.target.checked })}
                          style={{ width: 20, height: 20, accentColor: HQ.MENTOR }}
                        />
                        تفعيل فودافون كاش كطريقة دفع نشطة
                      </label>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="pay-voda-inst" style={lblSm}>إرشادات التحويل للطلاب</label>
                    <textarea
                      id="pay-voda-inst"
                      rows={3}
                      value={settings.vodafoneInstructions}
                      onChange={(e) => setSettings({ ...settings, vodafoneInstructions: e.target.value })}
                      placeholder="قم بالتحويل عبر كود *9*7*الرقم*المبلغ# أو تطبيق أنا فودافون..."
                      className="focus:border-[#177B58] focus:outline-none" style={field}
                    />
                  </div>
                </div>
              </div>

              {/* InstaPay Configuration Card */}
              <div style={panel}>
                <div className="flex items-center gap-3 pb-4 mb-6" style={{ borderBottom: `1px solid ${HQ.LINE}` }}>
                  <span aria-hidden style={{
                    width: 40, height: 40, borderRadius: 14, background: '#E2EFE7', color: HQ.MENTOR,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
                  }}>
                    <Building2 size={19} />
                  </span>
                  <div>
                    <h2 className="font-extrabold" style={{ fontSize: '1.25rem', color: HQ.INK, margin: 0 }}>إعدادات انستاباي (InstaPay Egypt)</h2>
                    <p className="text-xs mt-0.5" style={{ color: HQ.MUTED, margin: 0 }}>تحديد العنوان اللحظي (IPA) ورقم الهاتف واسم الحساب المستلم</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="pay-ipa" style={lblSm}>عنوان الدفع اللحظي للانستاباي (IPA Address) *</label>
                    <input
                      id="pay-ipa"
                      type="text"
                      required
                      value={settings.instaPayAddress}
                      onChange={(e) => setSettings({ ...settings, instaPayAddress: e.target.value })}
                      placeholder="academy@instapay"
                      className="focus:border-[#177B58] focus:outline-none"
                      style={{ ...field, direction: 'ltr', textAlign: 'left' }} dir="ltr"
                    />
                  </div>

                  <div>
                    <label htmlFor="pay-ipa-name" style={lblSm}>اسم صاحب الحساب المستلم *</label>
                    <input
                      id="pay-ipa-name"
                      type="text"
                      required
                      value={settings.instaPayAccountName}
                      onChange={(e) => setSettings({ ...settings, instaPayAccountName: e.target.value })}
                      placeholder="أكاديمية تحفيظ القرآن الكريم"
                      className="focus:border-[#177B58] focus:outline-none" style={field}
                    />
                  </div>

                  <div>
                    <label htmlFor="pay-ipa-phone" style={lblSm}>رقم الهاتف المرتبط بانستاباي</label>
                    <input
                      id="pay-ipa-phone"
                      type="text"
                      value={settings.instaPayPhone}
                      onChange={(e) => setSettings({ ...settings, instaPayPhone: e.target.value })}
                      placeholder="01012345678"
                      className="focus:border-[#177B58] focus:outline-none"
                      style={{ ...field, direction: 'ltr', textAlign: 'left', fontVariantNumeric: 'tabular-nums' }} dir="ltr"
                    />
                  </div>

                  <div>
                    <label style={lblSm}>حالة انستاباي</label>
                    <div className="flex items-center gap-4 mt-3">
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-bold" style={{ color: HQ.INK, minHeight: 48 }}>
                        <input
                          type="checkbox"
                          checked={settings.instaPayEnabled}
                          onChange={(e) => setSettings({ ...settings, instaPayEnabled: e.target.checked })}
                          style={{ width: 20, height: 20, accentColor: HQ.MENTOR }}
                        />
                        تفعيل انستاباي كطريقة دفع نشطة
                      </label>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="pay-ipa-inst" style={lblSm}>إرشادات التحويل عبر انستاباي للطلاب</label>
                    <textarea
                      id="pay-ipa-inst"
                      rows={3}
                      value={settings.instaPayInstructions}
                      onChange={(e) => setSettings({ ...settings, instaPayInstructions: e.target.value })}
                      placeholder="قم بالتحويل عبر تطبيق انستاباي إلى العنوان اللحظي أو رقم الهاتف الموضح..."
                      className="focus:border-[#177B58] focus:outline-none" style={field}
                    />
                  </div>
                </div>
              </div>

              {/* Single Plan Pricing & Discounts */}
              <div style={panel}>
                <div className="flex items-center gap-3 pb-4 mb-6" style={{ borderBottom: `1px solid ${HQ.LINE}` }}>
                  <span aria-hidden style={{
                    width: 40, height: 40, borderRadius: 14, background: '#E2EFE7', color: HQ.MENTOR,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
                  }}>
                    <DollarSign size={19} />
                  </span>
                  <div>
                    <h2 className="font-extrabold" style={{ fontSize: '1.25rem', color: HQ.INK, margin: 0 }}>إعدادات الخطة الموحدة والأسعار</h2>
                    <p className="text-xs mt-0.5" style={{ color: HQ.MUTED, margin: 0 }}>تحديد رسوم الاشتراك الشهري الموحد ونسب الخصومات</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="pay-plan-name" style={lblSm}>اسم الخطة / الباقة</label>
                      <input
                        id="pay-plan-name"
                        type="text"
                        value={settings.plan?.name || ''}
                        onChange={(e) => setSettings({
                          ...settings,
                          plan: { ...settings.plan, name: e.target.value }
                        })}
                        placeholder="الاشتراك الشهري في حلقات القرآن الكريم"
                        className="font-bold focus:border-[#177B58] focus:outline-none" style={field}
                      />
                    </div>
                    <div>
                      <label htmlFor="pay-plan-desc" style={lblSm}>وصف الخطة</label>
                      <input
                        id="pay-plan-desc"
                        type="text"
                        value={settings.plan?.description || ''}
                        onChange={(e) => setSettings({
                          ...settings,
                          plan: { ...settings.plan, description: e.target.value }
                        })}
                        placeholder="اشتراك شهري شامل لكافة الحلقات والمتابعة"
                        className="focus:border-[#177B58] focus:outline-none" style={field}
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4 p-4" style={{ background: HQ.PAPER, borderRadius: 12, border: `1px solid ${HQ.LINE}` }}>
                    <div>
                      <label htmlFor="pay-egp" style={lblSm}>السعر الشهري (جنيه مصري)</label>
                      <input
                        id="pay-egp"
                        type="number"
                        value={settings.plan?.priceEGP ?? 250}
                        onChange={(e) => setSettings({
                          ...settings,
                          plan: { ...settings.plan, priceEGP: Number(e.target.value) }
                        })}
                        className="font-bold focus:border-[#177B58] focus:outline-none"
                        style={{ ...field, fontVariantNumeric: 'tabular-nums' }}
                      />
                    </div>
                    <div>
                      <label htmlFor="pay-q" style={lblSm}>خصم 3 شهور (%)</label>
                      <input
                        id="pay-q"
                        type="number"
                        value={settings.plan?.quarterlyDiscountPercent ?? 10}
                        onChange={(e) => setSettings({
                          ...settings,
                          plan: { ...settings.plan, quarterlyDiscountPercent: Number(e.target.value) }
                        })}
                        className="font-bold focus:border-[#177B58] focus:outline-none"
                        style={{ ...field, fontVariantNumeric: 'tabular-nums' }}
                      />
                    </div>
                    <div>
                      <label htmlFor="pay-a" style={lblSm}>خصم السنوي (%)</label>
                      <input
                        id="pay-a"
                        type="number"
                        value={settings.plan?.annualDiscountPercent ?? 20}
                        onChange={(e) => setSettings({
                          ...settings,
                          plan: { ...settings.plan, annualDiscountPercent: Number(e.target.value) }
                        })}
                        className="font-bold focus:border-[#177B58] focus:outline-none"
                        style={{ ...field, fontVariantNumeric: 'tabular-nums' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Free Trial & Expiry Reminder Rules */}
              <div style={panel}>
                <div className="flex items-center gap-3 pb-4 mb-6" style={{ borderBottom: `1px solid ${HQ.LINE}` }}>
                  <span aria-hidden style={{
                    width: 40, height: 40, borderRadius: 14, background: '#E2EFE7', color: HQ.MENTOR,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
                  }}>
                    <Clock size={19} />
                  </span>
                  <div>
                    <h2 className="font-extrabold" style={{ fontSize: '1.25rem', color: HQ.INK, margin: 0 }}>قواعد المحاضرة التجريبية وتنبيهات نهاية الشهر</h2>
                    <p className="text-xs mt-0.5" style={{ color: HQ.MUTED, margin: 0 }}>تحديد عدد الجلسات المجانية المتاحة قبل طلب الاشتراك وأيام التنبيه قبل الانتهاء</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="p-5" style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12 }}>
                    <label htmlFor="pay-trial" className="block text-xs font-bold mb-1.5" style={{ color: HQ.INK }}>
                      عدد المحاضرات التجريبية المجانية للطالب الجديد
                    </label>
                    <input
                      id="pay-trial"
                      type="number"
                      min={1}
                      max={5}
                      value={settings.freeTrialSessionsCount ?? 1}
                      onChange={(e) => setSettings({ ...settings, freeTrialSessionsCount: Number(e.target.value) })}
                      className="font-black focus:border-[#177B58] focus:outline-none"
                      style={{ ...field, fontVariantNumeric: 'tabular-nums' }}
                    />
                    <p className="mt-2" style={{ fontSize: '0.8125rem', color: HQ.MUTED }}>
                      الافتراضي (1 محاضرة): يسجل الطالب ويحضر أول جلسة مجاناً، ثم يُطلب منه الاشتراك لمتابعة الحضور.
                    </p>
                  </div>

                  <div className="p-5" style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12 }}>
                    <label htmlFor="pay-remind" className="block text-xs font-bold mb-1.5" style={{ color: HQ.INK }}>
                      بدء تنبيه السداد قبل انتهاء الاشتراك بـ (أيام)
                    </label>
                    <input
                      id="pay-remind"
                      type="number"
                      min={1}
                      max={10}
                      value={settings.reminderDaysBeforeExpiry ?? 3}
                      onChange={(e) => setSettings({ ...settings, reminderDaysBeforeExpiry: Number(e.target.value) })}
                      className="font-black focus:border-[#177B58] focus:outline-none"
                      style={{ ...field, fontVariantNumeric: 'tabular-nums' }}
                    />
                    <p className="mt-2" style={{ fontSize: '0.8125rem', color: HQ.MUTED }}>
                      الافتراضي (3 أيام): يظهر تنبيه للمستخدم بالسداد عند اقتراب نهاية الشهر. وإذا لم يدفع يُعلّق وصوله للحلقات مؤقتاً حتى السداد.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="pay-wa" style={lblSm}>رقم واتساب المساعدة والدعم</label>
                    <input
                      id="pay-wa"
                      type="text"
                      value={settings.supportWhatsapp || ''}
                      onChange={(e) => setSettings({ ...settings, supportWhatsapp: e.target.value })}
                      placeholder="201012345678"
                      className="focus:border-[#177B58] focus:outline-none"
                      style={{ ...field, direction: 'ltr', textAlign: 'left', fontVariantNumeric: 'tabular-nums' }} dir="ltr"
                    />
                  </div>

                  <div>
                    <label htmlFor="pay-support" style={lblSm}>هاتف خدمة العملاء</label>
                    <input
                      id="pay-support"
                      type="text"
                      value={settings.supportPhone || ''}
                      onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })}
                      placeholder="01012345678"
                      className="focus:border-[#177B58] focus:outline-none"
                      style={{ ...field, direction: 'ltr', textAlign: 'left', fontVariantNumeric: 'tabular-nums' }} dir="ltr"
                    />
                  </div>
                </div>
              </div>

              {/* Save button */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={settingsLoading}
                  className="hq-action"
                  style={{ background: HQ.MENTOR, color: '#fff', fontSize: 14, padding: '0 32px', opacity: settingsLoading ? 0.6 : 1 }}
                >
                  {settingsLoading ? <LoadingSpinner size="sm" color="white" /> : <Check size={15} aria-hidden />}
                  حفظ وتحديث الإعدادات
                </button>
              </div>

            </form>
          )}

        </div>

      {/* APPROVE PAYMENT MODAL */}
      <AnimatePresence>
        {approveModalPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => !actionLoading && setApproveModalPayment(null)}
              className="fixed inset-0"
              style={{ background: 'rgba(42,36,56,0.55)' }}
            />
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2 }}
              role="dialog" aria-modal="true" aria-label="تأكيد اعتماد الدفعة"
              className="max-w-md w-full z-10 relative"
              style={{ ...panel, maxHeight: '90dvh', overflowY: 'auto' }}
            >
              <h3 className="font-extrabold mb-2" style={{ fontSize: '1.25rem', color: HQ.INK, marginTop: 0 }}>
                تأكيد اعتماد الدفعة وتفعيل الاشتراك
              </h3>
              <p className="text-xs leading-relaxed mb-6" style={{ color: HQ.MUTED }}>
                سيتم تفعيل باقة ({approveModalPayment.plan === 'premium' ? 'المميزة' : 'الأساسية'}) للطالب{' '}
                <span className="font-bold" style={{ color: HQ.INK }}>{approveModalPayment.user?.firstName} {approveModalPayment.user?.lastName}</span>{' '}
                وإرسال إشعار لحظي له.
              </p>

              <div className="space-y-4 mb-6">
                <div>
                  <span style={lblSm} id="pay-days-label">مدة الاشتراك الممنوحة بالأيام:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="group" aria-labelledby="pay-days-label">
                    {[
                      { days: 30, label: '30 يوماً' },
                      { days: 90, label: '90 يوماً' },
                      { days: 365, label: 'سنة كاملة' },
                    ].map((d) => (
                      <button
                        key={d.days}
                        type="button"
                        onClick={() => setCustomDays(d.days)}
                        aria-pressed={customDays === d.days}
                        className="text-xs font-bold"
                        style={{
                          minHeight: 48, borderRadius: 12, cursor: 'pointer',
                          border: `2px solid ${customDays === d.days ? HQ.MENTOR : HQ.LINE}`,
                          background: customDays === d.days ? HQ.MENTOR : HQ.SURFACE,
                          color: customDays === d.days ? '#fff' : HQ.MUTED, fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="pay-custom-days" style={lblSm}>أو حدد عدد أيام مخصص:</label>
                  <input
                    id="pay-custom-days"
                    type="number"
                    value={customDays}
                    onChange={(e) => setCustomDays(Number(e.target.value))}
                    min={1}
                    max={1000}
                    className="font-bold focus:border-[#177B58] focus:outline-none"
                    style={{ ...field, fontVariantNumeric: 'tabular-nums' }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="hq-action"
                  style={{ flex: 1, background: HQ.MENTOR, color: '#fff', fontSize: 14, opacity: actionLoading ? 0.6 : 1 }}
                >
                  {actionLoading ? <LoadingSpinner size="sm" color="white" /> : <Check size={15} aria-hidden />}
                  تأكيد القبول والتفعيل
                </button>
                <button
                  type="button"
                  onClick={() => setApproveModalPayment(null)}
                  disabled={actionLoading}
                  className="hq-action"
                  style={{ padding: '0 16px', background: HQ.PAPER, color: HQ.INK, fontSize: 14 }}
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REJECT PAYMENT MODAL */}
      <AnimatePresence>
        {rejectModalPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => !actionLoading && setRejectModalPayment(null)}
              className="fixed inset-0"
              style={{ background: 'rgba(42,36,56,0.55)' }}
            />
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2 }}
              role="dialog" aria-modal="true" aria-label="رفض طلب الدفع"
              className="max-w-md w-full z-10 relative"
              style={{ ...panel, maxHeight: '90dvh', overflowY: 'auto' }}
            >
              <h3 className="font-extrabold mb-2" style={{ fontSize: '1.25rem', color: '#C2410C', marginTop: 0 }}>
                رفض طلب الدفع
              </h3>
              <p className="text-xs mb-4" style={{ color: HQ.MUTED }}>
                يرجى كتابة سبب الرفض بوضوح ليتم إرساله للطالب في الإشعارات ليتمكن من معالجة المشكلة.
              </p>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {[
                  'صورة الإيصال غير واضحة',
                  'المبلغ المحول غير مطابق',
                  'رقم العملية غير موجود',
                  'لم يتم استلام التحويل بالمحفظة',
                ].map((reasonText) => (
                  <button
                    key={reasonText}
                    type="button"
                    onClick={() => setRejectReason(reasonText)}
                    aria-pressed={rejectReason === reasonText}
                    className="font-medium"
                    style={{
                      fontSize: '0.8125rem', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', minHeight: 44,
                      background: rejectReason === reasonText ? '#C2410C' : HQ.PAPER,
                      color: rejectReason === reasonText ? '#fff' : HQ.INK,
                      border: `1px solid ${rejectReason === reasonText ? '#C2410C' : HQ.LINE}`,
                    }}
                  >
                    {reasonText}
                  </button>
                ))}
              </div>

              <div className="mb-6">
                <label htmlFor="pay-reject-reason" style={lblSm}>سبب الرفض *</label>
                <textarea
                  id="pay-reject-reason"
                  rows={3}
                  required
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="اكتب سبب الرفض هنا..."
                  className="focus:border-[#177B58] focus:outline-none" style={field}
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="hq-action"
                  style={{ flex: 1, background: '#C2410C', color: '#fff', fontSize: 14, opacity: actionLoading ? 0.6 : 1 }}
                >
                  {actionLoading ? <LoadingSpinner size="sm" color="white" /> : <X size={15} aria-hidden />}
                  تأكيد الرفض
                </button>
                <button
                  type="button"
                  onClick={() => setRejectModalPayment(null)}
                  disabled={actionLoading}
                  className="hq-action"
                  style={{ padding: '0 16px', background: HQ.PAPER, color: HQ.INK, fontSize: 14 }}
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RECEIPT PREVIEW MODAL */}
      <AnimatePresence>
        {previewReceiptUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setPreviewReceiptUrl(null)}
              className="fixed inset-0"
              style={{ background: 'rgba(42,36,56,0.55)' }}
            />
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2 }}
              role="dialog" aria-modal="true" aria-label="معاينة صورة إيصال التحويل"
              className="max-w-2xl w-full z-10 relative overflow-hidden"
              style={{ ...panel, padding: 16 }}
            >
              <div className="flex items-center justify-between pb-3 mb-3" style={{ borderBottom: `1px solid ${HQ.LINE}` }}>
                <h4 className="font-bold text-sm" style={{ color: HQ.INK, margin: 0 }}>معاينة صورة إيصال التحويل</h4>
                <button
                  type="button"
                  onClick={() => setPreviewReceiptUrl(null)}
                  aria-label="إغلاق المعاينة"
                  style={iconBtn}
                >
                  <X size={16} aria-hidden />
                </button>
              </div>
              <div className="overflow-y-auto flex justify-center rounded-2xl p-2" style={{ maxHeight: '75vh', background: HQ.PAPER }}>
                <img
                  src={previewReceiptUrl}
                  alt="صورة إيصال التحويل"
                  className="rounded-lg"
                  style={{ maxHeight: '70vh', objectFit: 'contain' }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PageLayout>
    </MotionConfig>
  );
}
