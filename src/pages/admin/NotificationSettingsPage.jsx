import { useState, useEffect } from 'react';
import { Bell, BellOff, Radio, FileText, CreditCard, MessageCircle, Megaphone } from 'lucide-react';
import toast from 'react-hot-toast';
import PageLayout from '../../components/shared/PageLayout';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import api from '../../services/api';
import '../../components/halaqa/halaqa.css';
import { HQ } from '../../components/halaqa/primitives';

/* مفتاح التنبيهات الرئيسي + مفاتيح الفئات — يتحكم فيما يُنشأ ويُرسل
   (قاعدة البيانات + Web Push) دون المساس بسجل التنبيهات القديم. */

const CATEGORIES = [
  { key: 'live', label: 'البث المباشر ومواعيده', hint: 'بدء البث، الجلسات المجدولة، تنبيه حان الموعد', icon: Radio },
  { key: 'exams', label: 'الامتحانات والتقييمات', hint: 'إسناد امتحان، نتائج، مراجعات التسميع', icon: FileText },
  { key: 'payments', label: 'المدفوعات والاشتراكات', hint: 'طلبات السداد، الاعتماد، الرفض، التذكير', icon: CreditCard },
  { key: 'discussion', label: 'المناقشات والرسائل', hint: 'رسائل الطلاب وردود الإدارة', icon: MessageCircle },
  { key: 'general', label: 'العامة', hint: 'مستخدم جديد، قبول، خطط، حضور، رسائل إدارية', icon: Megaphone },
];

function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 56, height: 32, borderRadius: 9999, border: 'none', cursor: disabled ? 'default' : 'pointer',
        background: checked ? HQ.MENTOR : HQ.LINE, position: 'relative', flex: 'none',
        transition: 'background 0.2s ease', opacity: disabled ? 0.5 : 1,
      }}
    >
      <span aria-hidden style={{
        position: 'absolute', top: 3, width: 26, height: 26, borderRadius: 9999, background: '#fff',
        boxShadow: '0 1px 4px rgba(42,36,56,0.25)', transition: 'inset-inline-start 0.2s ease',
        insetInlineStart: checked ? 27 : 3,
      }} />
    </button>
  );
}

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const res = await api.get('/notifications/settings');
      setSettings(res.data?.settings || { enabled: true, categories: {} });
    } catch (_) {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const persist = async (next) => {
    setSettings(next);
    setSaving(true);
    try {
      const res = await api.put('/notifications/settings', {
        enabled: next.enabled,
        categories: next.categories,
      });
      if (res.data?.settings) setSettings(res.data.settings);
      toast.success('تم حفظ إعدادات التنبيهات');
    } catch (_) {
      toast.error('تعذر الحفظ — أعد تحميل الصفحة وحاول مجدداً');
      fetchSettings();
    } finally {
      setSaving(false);
    }
  };

  const toggleMaster = (value) => {
    persist({ ...settings, enabled: value });
  };

  const toggleCategory = (key, value) => {
    persist({ ...settings, categories: { ...(settings.categories || {}), [key]: value } });
  };

  return (
    <PageLayout>
      <div className="halaqa" style={{ maxWidth: 720, margin: '0 auto' }}>
        <p style={{ margin: 0, fontSize: 14, color: HQ.MUTED }}>التحكم في التنبيهات</p>
        <h1 style={{ margin: '2px 0 16px', fontSize: 28, fontWeight: 800, color: HQ.INK }}>
          مفتاح التنبيهات
        </h1>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><LoadingSpinner size="md" text="جارٍ جلب الإعدادات..." /></div>
        ) : loadFailed || !settings ? (
          <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 40, textAlign: 'center' }} role="alert">
            <p style={{ margin: '0 0 20px', fontSize: 14, color: HQ.MUTED }}>تعذر تحميل إعدادات التنبيهات.</p>
            <button type="button" onClick={fetchSettings} className="hq-action" style={{ background: HQ.MENTOR, color: '#fff', padding: '0 24px', fontSize: 15 }}>
              إعادة المحاولة
            </button>
          </div>
        ) : (
          <>
            {/* Master switch */}
            <section aria-label="المفتاح الرئيسي"
              style={{
                background: settings.enabled ? HQ.SURFACE : '#FDECEC',
                border: `2px solid ${settings.enabled ? HQ.LINE : '#C2410C'}`,
                borderRadius: 18, padding: 20, marginBottom: 16,
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span aria-hidden style={{
                  width: 48, height: 48, borderRadius: 14, flex: 'none',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: settings.enabled ? '#E2EFE7' : '#F8D7D7',
                  color: settings.enabled ? HQ.MENTOR : '#C2410C',
                }}>
                  {settings.enabled ? <Bell size={22} /> : <BellOff size={22} />}
                </span>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <strong style={{ display: 'block', fontSize: 17, color: HQ.INK }}>
                    {settings.enabled ? 'التنبيهات مفعّلة' : 'التنبيهات متوقفة مؤقتاً'}
                  </strong>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: HQ.MUTED, lineHeight: 1.7 }}>
                    {settings.enabled
                      ? 'تصل التنبيهات للطلاب والطاقم (جرس الموقع + فوري). السجل القديم محفوظ ولا يتأثر.'
                      : 'متوقفة: لن يُنشأ أي تنبيه جديد ولن يُرسل أي فوري — والقديم يبقى ظاهراً. فعّلها للعودة.'}
                  </p>
                </div>
                <Toggle
                  checked={settings.enabled}
                  onChange={toggleMaster}
                  label={settings.enabled ? 'إيقاف كل التنبيهات' : 'تفعيل كل التنبيهات'}
                  disabled={saving}
                />
              </div>
            </section>

            {/* Per-category switches */}
            <section aria-label="تنبيهات الفئات"
              style={{
                background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`,
                borderRadius: 18, padding: 20, opacity: settings.enabled ? 1 : 0.55,
              }}>
              <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: HQ.INK }}>تنبيهات الفئات</h2>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: HQ.MUTED }}>
                تحكم دقيق — تُطبق فقط والمفتاح الرئيسي مفعّل.
              </p>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {CATEGORIES.map(({ key, label, hint, icon: Icon }) => {
                  const checked = settings.categories?.[key] !== false;
                  return (
                    <li key={key} style={{
                      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                      background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 14, padding: '12px 14px',
                    }}>
                      <span aria-hidden style={{
                        width: 40, height: 40, borderRadius: 12, flex: 'none',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: checked ? '#E2EFE7' : HQ.PAPER, color: checked ? HQ.MENTOR : HQ.MUTED,
                      }}>
                        <Icon size={19} />
                      </span>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <strong style={{ display: 'block', fontSize: 15, color: HQ.INK }}>{label}</strong>
                        <span style={{ fontSize: 13, color: HQ.MUTED }}>{hint}</span>
                      </div>
                      <Toggle
                        checked={checked}
                        onChange={(v) => toggleCategory(key, v)}
                        label={`${label}: ${checked ? 'مفعّلة' : 'متوقفة'}`}
                        disabled={saving || !settings.enabled}
                      />
                    </li>
                  );
                })}
              </ol>
              {saving && (
                <p style={{ margin: '12px 0 0', fontSize: 13, color: HQ.MUTED }}>جارٍ الحفظ...</p>
              )}
            </section>
          </>
        )}
      </div>
    </PageLayout>
  );
}
