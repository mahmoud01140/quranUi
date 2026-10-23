import { useEffect, useRef, useState } from 'react';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  AlertCircle, Radio
} from 'lucide-react';

export default function AgoraMeeting({
  appId,
  channel,
  token = null,
  displayName = 'مستخدم',
  isTeacher = false,
  onLeave,
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const clientRef = useRef(null);
  const localTracksRef = useRef({ audio: null, video: null });

  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [micMuted, setMicMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(!isTeacher);

  // التحقق من وجود App ID
  if (!appId) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0F172A] text-white p-6 text-center" dir="rtl">
        <div className="p-5 bg-sky-500/10 border border-sky-500/30 rounded-2xl max-w-md flex flex-col items-center gap-3">
          <AlertCircle className="text-sky-400" size={36} />
          <h3 className="font-bold text-base text-sky-200">بث Agora غير مهيأ بالكامل</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            يرجى إدخال <strong>Agora App ID</strong> في لوحة تحكم الأدمن (إعدادات البث المباشر) لتفعيل البث عبر شبكة Agora.
          </p>
          {onLeave && (
            <button
              onClick={onLeave}
              className="mt-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-xs font-bold rounded-xl transition-all"
            >
              الرجوع
            </button>
          )}
        </div>
      </div>
    );
  }

  // تحميل Agora Web SDK ديناميكياً
  useEffect(() => {
    let isMounted = true;

    const loadAgoraScript = () => {
      return new Promise((resolve, reject) => {
        if (window.AgoraRTC) {
          resolve(window.AgoraRTC);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://download.agora.io/sdk/release/AgoraRTC_N-4.20.0.js';
        script.async = true;
        script.onload = () => resolve(window.AgoraRTC);
        script.onerror = () => reject(new Error('تعذّر تحميل مكتبة Agora RTC'));
        document.body.appendChild(script);
      });
    };

    const initAgora = async () => {
      try {
        const AgoraRTC = await loadAgoraScript();
        if (!isMounted) return;

        AgoraRTC.setLogLevel(3); // التحذيرات والأخطاء فقط

        const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        clientRef.current = client;

        // الاستماع لدخول المشاركين الآخرين
        client.on('user-published', async (user, mediaType) => {
          await client.subscribe(user, mediaType);
          if (mediaType === 'video' && remoteVideoRef.current) {
            user.videoTrack.play(remoteVideoRef.current);
          }
          if (mediaType === 'audio') {
            user.audioTrack.play();
          }
        });

        client.on('user-unpublished', (user, mediaType) => {
          if (mediaType === 'video' && remoteVideoRef.current) {
            remoteVideoRef.current.innerHTML = '';
          }
        });

        // الانضمام للقناة
        const cleanChannel = (channel || 'quran_live').replace(/[^a-zA-Z0-9_-]/g, '_');
        await client.join(appId, cleanChannel, token || null, null);

        // إنشاء المسارات المحلية
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
          ANS: true,
          AEC: true,
        });

        let videoTrack = null;
        try {
          videoTrack = await AgoraRTC.createCameraVideoTrack({
            encoderConfig: '720p_1',
          });
          if (!isTeacher) {
            // الطالب يبدأ بكاميرا مغلقة
            await videoTrack.setEnabled(false);
          }
        } catch (_) {}

        localTracksRef.current = { audio: audioTrack, video: videoTrack };

        // نشر المسارات
        const tracksToPublish = [audioTrack, videoTrack].filter(Boolean);
        await client.publish(tracksToPublish);

        // تشغيل الفيديو المحلي
        if (videoTrack && localVideoRef.current) {
          videoTrack.play(localVideoRef.current);
        }

        if (isMounted) {
          setJoined(true);
          setLoading(false);
        }
      } catch (err) {
        console.error('Agora init error:', err);
        if (isMounted) {
          const raw = err.message || '';
          if (raw.includes('dynamic use static key') || raw.includes('CAN_NOT_GET_GATEWAY_SERVER')) {
            setErrorMsg(
              'مشروع Agora الخاص بك يتطلب Primary Certificate: يرجى نسخ "Primary Certificate" من صفحة المشروع في console.agora.io ولصقه في حقل (App Certificate) في لوحة تحكم الأدمن ➔ إعدادات البث المباشر لكي يقوم السيرفر بتوليد التوكن تلقائياً.'
            );
          } else {
            setErrorMsg('حدث خطأ أثناء الانضمام لبث Agora: ' + raw);
          }
          setLoading(false);
        }
      }
    };

    initAgora();

    return () => {
      isMounted = false;
      const { audio, video } = localTracksRef.current;
      if (audio) { audio.stop(); audio.close(); }
      if (video) { video.stop(); video.close(); }
      if (clientRef.current) {
        clientRef.current.leave().catch(() => {});
      }
    };
  }, [appId, channel, token, isTeacher]);

  const toggleMic = async () => {
    const { audio } = localTracksRef.current;
    if (!audio) return;
    const next = !micMuted;
    await audio.setEnabled(!next);
    setMicMuted(next);
  };

  const toggleVideo = async () => {
    const { video } = localTracksRef.current;
    if (!video) return;
    const next = !videoOff;
    await video.setEnabled(!next);
    setVideoOff(next);
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-[#090D16] text-white overflow-hidden select-none" dir="rtl">
      {/* شريط المعلومات العلوي */}
      <div className="absolute top-3 right-3 left-3 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs font-semibold">
          <Radio size={13} className="text-sky-400 animate-pulse" />
          <span>بث Agora السحابي عالي الاستقرار</span>
        </div>
        <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs text-slate-300">
          {displayName}
        </div>
      </div>

      {/* مساحة الفيديو */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center bg-[#070B12]">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-slate-300">
            <div className="w-12 h-12 rounded-full border-2 border-sky-500/30 border-t-sky-500 animate-spin" />
            <p className="text-sm font-medium">جارٍ الاتصال بشبكة Agora...</p>
          </div>
        ) : errorMsg ? (
          <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-300 text-sm">
            {errorMsg}
          </div>
        ) : (
          <>
            {/* الطرف الآخر */}
            <div ref={remoteVideoRef} className="w-full h-full flex items-center justify-center" />

            {/* المحلي */}
            <div className="absolute bottom-20 left-4 z-20 w-36 sm:w-44 aspect-video rounded-xl overflow-hidden shadow-2xl border-2 border-white/20 bg-slate-900">
              <div ref={localVideoRef} className={`w-full h-full ${videoOff ? 'hidden' : 'block'}`} />
              {videoOff && (
                <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-400 text-xs font-bold">
                  الكاميرا مغلقة
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* شريط التحكم السفلي */}
      {joined && (
        <div className="relative z-30 h-16 bg-slate-950/80 backdrop-blur-lg border-t border-white/10 px-4 flex items-center justify-center gap-3">
          <button
            onClick={toggleMic}
            className={`p-3 rounded-full transition-all ${
              micMuted ? 'bg-rose-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            title={micMuted ? 'تشغيل الميكروفون' : 'كتم الميكروفون'}
          >
            {micMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <button
            onClick={toggleVideo}
            className={`p-3 rounded-full transition-all ${
              videoOff ? 'bg-rose-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            title={videoOff ? 'تشغيل الكاميرا' : 'إيقاف الكاميرا'}
          >
            {videoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>

          <button
            onClick={() => {
              if (onLeave) onLeave();
            }}
            className="p-3 px-5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5 transition-all shadow-lg"
          >
            <PhoneOff size={18} />
            <span className="text-xs">مغادرة</span>
          </button>
        </div>
      )}
    </div>
  );
}
