import { useState } from 'react';
import { Video, AlertCircle, PhoneOff } from 'lucide-react';

export default function DailyMeeting({
  roomUrl,
  displayName = 'مستخدم',
  onLeave,
}) {
  const [loading, setLoading] = useState(true);

  if (!roomUrl) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0F172A] text-white p-6 text-center" dir="rtl">
        <div className="p-6 bg-purple-950/40 border border-purple-500/30 rounded-2xl max-w-lg flex flex-col items-center gap-3.5 shadow-xl">
          <div className="p-3 bg-purple-500/20 text-purple-300 rounded-full">
            <Video size={32} />
          </div>
          <h3 className="font-bold text-base sm:text-lg text-purple-200">
            مطلوب ربط مفتاح Daily.co API Key
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            لإنشاء غرف بث Daily.co تلقائياً على حسابك، يرجى إنشاء حساب مجاني على{' '}
            <a
              href="https://dashboard.daily.co/signup"
              target="_blank"
              rel="noreferrer"
              className="text-purple-400 font-bold underline hover:text-purple-300"
            >
              dashboard.daily.co
            </a>
            {' '}ثم نسخ <strong>API Key</strong> الخاص بك ووضعه في <strong>لوحة تحكم الأدمن ➔ إعدادات البث المباشر</strong>.
          </p>
          <div className="text-xs bg-slate-800/80 p-2.5 rounded-xl border border-white/10 text-slate-400">
            💡 نصيحة: إذا كنت تريد بثاً فورياً الآن دون مفاتيح، يمكنك التبديل إلى <strong>WebRTC P2P</strong> أو <strong>Jitsi Meet</strong> بنقرة زر من لوحة الأدمن.
          </div>
          {onLeave && (
            <button
              onClick={onLeave}
              className="mt-1 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              الرجوع
            </button>
          )}
        </div>
      </div>
    );
  }

  // تمرير اسم المستخدم إلى Daily عبر رابط الغرفة بأمان
  let finalUrl = roomUrl;
  try {
    const parsed = new URL(roomUrl);
    if (displayName) {
      parsed.searchParams.set('t', displayName);
    }
    finalUrl = parsed.toString();
  } catch (_) {
    finalUrl = roomUrl;
  }

  return (
    <div className="relative w-full h-full bg-[#0F172A] overflow-hidden">
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0F172A] text-white gap-3">
          <div className="w-12 h-12 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Video size={16} className="text-indigo-400" />
            <span>جارٍ تحميل غرفة Daily.co المباشرة...</span>
          </div>
        </div>
      )}

      {/* زر مغادرة عائم للطوارئ */}
      {onLeave && (
        <button
          onClick={onLeave}
          className="absolute top-3 left-3 z-30 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg transition-all"
          title="مغادرة الغرفة"
        >
          <PhoneOff size={13} />
          <span>مغادرة</span>
        </button>
      )}

      <iframe
        src={urlWithParams.toString()}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        className="w-full h-full border-0"
        onLoad={() => setLoading(false)}
        title="Daily.co Live Session"
      />
    </div>
  );
}
