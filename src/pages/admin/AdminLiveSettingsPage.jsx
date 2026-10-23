import { useState, useEffect } from 'react';
import {
  Video, Sparkles, Wifi, Radio, Globe,
  Save, CheckCircle2, Key, RefreshCw, Info,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageLayout from '../../components/shared/PageLayout';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import api from '../../services/api';
import '../../components/halaqa/halaqa.css';
import { HQ, HqBadge } from '../../components/halaqa/primitives';

export default function AdminLiveSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    defaultProvider: 'auto',
    autoRouting: {
      oneOnOneProvider: 'webrtc',
      groupProvider: 'daily',
    },
    dailyApiKey: '',
    dailyDomain: '',
    agoraAppId: '',
    agoraAppCertificate: '',
    jitsiDomain: 'meet.element.io',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/live/settings');
      if (res.data?.settings) {
        setForm(prev => ({
          ...prev,
          ...res.data.settings,
          autoRouting: {
            ...prev.autoRouting,
            ...(res.data.settings.autoRouting || {}),
          },
        }));
      }
    } catch (err) {
      console.error('Failed to load live settings:', err);
      toast.error('تعذر جلب إعدادات البث');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/live/settings', form);
      if (res.data?.success) {
        toast.success(res.data.message || 'تم حفظ إعدادات البث بنجاح');
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      toast.error(err.response?.data?.message || 'خطأ أثناء حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const providersList = [
    {
      id: 'auto',
      title: 'الوضع التلقائي الذكي (Smart Auto)',
      badge: 'موصى به للغاية 🌟',
      badgeTone: 'mentor',
      icon: Sparkles,
      iconBg: '#E2EFE7',
      iconColor: HQ.MENTOR,
      description:
        'يحول الحصص الفردية (1-on-1) إلى WebRTC P2P مجاناً 100% بدون أي استهلاك للدقائق، ويستخدم Daily.co أو Agora للحلقات الجماعية.',
      cost: '0$ دائم + استغلال أقصى للدقائق المجانية',
    },
    {
      id: 'webrtc',
      title: 'WebRTC P2P المباشر',
      badge: 'مجاني للأبد 100%',
      badgeTone: 'mentor',
      icon: Wifi,
      iconBg: '#E2EFE7',
      iconColor: HQ.MENTOR,
      description:
        'اتصال مباشر ومشفر من متصفح المعلم إلى متصفح الطالب مباشرة بدون أي سيرفر وسيط. صفر تكلفة وبدون أي حدود للدقائق.',
      cost: '0$ دائماً (مثالي للحصص الفردية ومخارج الحروف)',
    },
    {
      id: 'daily',
      title: 'Daily.co Cloud',
      badge: '10,000 دقيقة مجانية/شهر',
      badgeTone: 'neutral',
      icon: Video,
      iconBg: '#F3E8FF',
      iconColor: '#7E22CE',
      description:
        'بث سحابي احترافي جاهز للعمل مع واجهة متقدمة وميزات مشاركة شاشة ممتازة للحلقات والجلسات.',
      cost: '10,000 دقيقة شهرياً مجاناً (~166 ساعة)',
    },
    {
      id: 'agora',
      title: 'شبكة Agora RTC',
      badge: '10,000 دقيقة مجانية/شهر',
      badgeTone: 'neutral',
      icon: Radio,
      iconBg: '#E0F2FE',
      iconColor: '#0284C7',
      description:
        'أعلى شبكة بث استقراراً مع خطوط الإنترنت الضعيفة، مناسبة جداً للطلاب في المناطق ذات الشبكات البطيئة.',
      cost: '10,000 دقيقة شهرياً مجاناً',
    },
    {
      id: 'jitsi',
      title: 'Jitsi Meet',
      badge: 'النظام الافتراضي',
      badgeTone: 'neutral',
      icon: Globe,
      iconBg: '#F1F5F9',
      iconColor: '#475569',
      description:
        'نظام Jitsi Meet المفتوح المصدر المعتمد حالياً، يعمل كخيار احتياطي ومستقل.',
      cost: 'مجاني',
    },
  ];

  return (
    <PageLayout>
      <div className="halaqa w-full max-w-5xl mx-auto px-3 sm:px-6 py-4" dir="rtl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#E5E0D8]">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <HqBadge tone="mentor">إدارة البث المباشر</HqBadge>
              <HqBadge tone="neutral">Multi-Provider Engine</HqBadge>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#2A2438] m-0">
              إعدادات البث المباشر
            </h1>
            <p className="text-xs sm:text-sm text-[#756E85] mt-1">
              تحكم في مزود الفيديو النشط (WebRTC P2P ، Daily.co ، Agora ، Jitsi) لتوفير التكاليف وضمان أعلى جودة.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#177B58] hover:bg-[#126346] text-white font-bold text-sm shadow-sm transition-all disabled:opacity-50 self-start md:self-auto cursor-pointer"
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            <span>{saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}</span>
          </button>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner size="lg" text="جارٍ تحميل إعدادات البث..." />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* قسم اختيار المزود */}
            <section className="bg-white rounded-2xl p-4 sm:p-6 border border-[#E5E0D8] shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-[#2A2438] m-0">
                    المزود الفعال للبث المباشر
                  </h2>
                  <p className="text-xs sm:text-sm text-[#756E85] mt-0.5">
                    انقر على المزود المطلوب لتفعيله فوراً على كافة الحصص.
                  </p>
                </div>
                <span className="inline-block text-xs bg-[#FBF7EE] text-[#177B58] font-bold px-3 py-1 rounded-full border border-[#E5E0D8] self-start sm:self-auto">
                  التبديل لحظي بدون إعادة تشغيل
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {providersList.map((p) => {
                  const isSelected = form.defaultProvider === p.id;
                  const Icon = p.icon;

                  return (
                    <div
                      key={p.id}
                      onClick={() => setForm(prev => ({ ...prev, defaultProvider: p.id }))}
                      className={`relative p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#177B58] bg-[#F4F9F6] shadow-xs'
                          : 'border-[#E5E0D8] bg-white hover:border-[#177B58]/50'
                      } ${p.id === 'auto' ? 'md:col-span-2' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="p-2.5 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: p.iconBg, color: p.iconColor }}
                          >
                            <Icon size={20} />
                          </span>
                          <div>
                            <h3 className="font-bold text-sm sm:text-base text-[#2A2438] m-0">
                              {p.title}
                            </h3>
                            <div className="mt-1">
                              <HqBadge tone={p.badgeTone}>{p.badge}</HqBadge>
                            </div>
                          </div>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                            isSelected ? 'border-[#177B58] bg-[#177B58]' : 'border-slate-300'
                          }`}
                        >
                          {isSelected && <Check size={13} className="text-white stroke-[3]" />}
                        </div>
                      </div>

                      <p className="text-xs text-[#756E85] leading-relaxed my-2.5">
                        {p.description}
                      </p>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500">التكلفة:</span>
                        <span className="font-bold text-[#177B58]">{p.cost}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* قسم إعدادات الربط بالمفاتيح (API Keys) */}
            <section className="bg-white rounded-2xl p-4 sm:p-6 border border-[#E5E0D8] shadow-xs space-y-5">
              <div>
                <h2 className="text-base sm:text-lg font-black text-[#2A2438] m-0 mb-1">
                  بيانات الربط والمفاتيح
                </h2>
                <p className="text-xs sm:text-sm text-[#756E85]">
                  اختيارية حسب المزود المختار؛ يمكنك إدخال المفاتيح للاستفادة من باقات الـ 10,000 دقيقة المجانية.
                </p>
              </div>

              {/* Daily.co config */}
              <div className="p-4 sm:p-5 rounded-xl border border-purple-100 bg-purple-50/40 space-y-3">
                <div className="flex items-center gap-2 text-purple-900 font-bold text-sm">
                  <Video size={17} className="text-purple-600 shrink-0" />
                  <span>إعدادات Daily.co (10,000 دقيقة مجاناً شهرياً)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Daily API Key:
                    </label>
                    <div className="relative">
                      <Key size={15} className="absolute right-3 top-3 text-slate-400" />
                      <input
                        type="password"
                        value={form.dailyApiKey}
                        onChange={(e) => setForm(prev => ({ ...prev, dailyApiKey: e.target.value }))}
                        placeholder="من dashboard.daily.co"
                        className="w-full pr-9 pl-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      لإنشاء الغرف تلقائياً عبر واجهة Daily REST API.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      نطاق Daily (أو الدومين):
                    </label>
                    <input
                      type="text"
                      value={form.dailyDomain}
                      onChange={(e) => setForm(prev => ({ ...prev, dailyDomain: e.target.value }))}
                      placeholder="مثال: myacademy أو myacademy.daily.co"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-purple-500"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      نطاق غرف Daily المخصص لأكاديميتك.
                    </span>
                  </div>
                </div>
              </div>

              {/* Agora config */}
              <div className="p-4 sm:p-5 rounded-xl border border-sky-100 bg-sky-50/40 space-y-3">
                <div className="flex items-center gap-2 text-sky-900 font-bold text-sm">
                  <Radio size={17} className="text-sky-600 shrink-0" />
                  <span>إعدادات Agora RTC (10,000 دقيقة مجاناً شهرياً)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Agora App ID:
                    </label>
                    <input
                      type="text"
                      value={form.agoraAppId}
                      onChange={(e) => setForm(prev => ({ ...prev, agoraAppId: e.target.value }))}
                      placeholder="من console.agora.io"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-sky-500"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      معرف التطبيق في لوحة تحكم Agora.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      App Certificate (اختياري للتوكن المؤقت):
                    </label>
                    <input
                      type="password"
                      value={form.agoraAppCertificate}
                      onChange={(e) => setForm(prev => ({ ...prev, agoraAppCertificate: e.target.value }))}
                      placeholder="اتركه فارغاً إذا كنت في وضع Testing (App ID Only)"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              </div>

              {/* Jitsi config */}
              <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                  <Globe size={17} className="text-slate-600 shrink-0" />
                  <span>إعدادات Jitsi Meet (الخيار الافتراضي الأصلي)</span>
                </div>

                <div className="max-w-md">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نطاق خادم Jitsi (Jitsi Domain):
                  </label>
                  <input
                    type="text"
                    value={form.jitsiDomain}
                    onChange={(e) => setForm(prev => ({ ...prev, jitsiDomain: e.target.value }))}
                    placeholder="meet.element.io"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-slate-500"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    الافتراضي: meet.element.io
                  </span>
                </div>
              </div>
            </section>

            {/* شريط الحفظ السفلي */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-8 py-3 rounded-xl bg-[#177B58] hover:bg-[#126346] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                <span>{saving ? 'جارٍ حفظ الإعدادات...' : 'حفظ وتفعيل المزود الآن'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </PageLayout>
  );
}
