import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * JitsiMeeting Component
 * Embeds a Jitsi Meet video conference inside the React application using the Jitsi External API.
 *
 * - Students join audio-muted by default
 * - Noise suppression enabled by default for clear recitation
 * - Students join video-off but may enable their camera freely
 */
export default function JitsiMeeting({
  roomName,
  displayName = 'مستخدم',
  userEmail = '',
  isTeacher = false,
  // Optional: display name of the moderator to keep pinned on stage.
  // When set for a student client, the stage always shows this participant
  // and the filmstrip is hidden — the student sees this video only and hears everyone.
  focusParticipantName = '',
  onApiReady,
  onLeave,
  height = '100%',
  width = '100%',
}) {
  const containerRef = useRef(null);
  const jitsiApiRef = useRef(null);
  const isDisposingRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const domain = import.meta.env.VITE_JITSI_DOMAIN || 'meet.element.io';

  // Focus mode (students only): stage locked on the moderator, no filmstrip.
  const focusMode = !isTeacher && focusParticipantName;

  // Sanitize room name for Jitsi compatibility
  const sanitizedRoomName = (roomName || 'quran_platform_session')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase();

  // أزرار المعلم: تحكم كامل
  const teacherToolbarButtons = [
    'camera',
    'chat',
    'closedcaptions',
    'desktop',
    'fullscreen',
    'hangup',
    'microphone',
    'noisesuppression',
    'participants-pane',
    'raisehand',
    'select-background',
    'settings',
    'toggle-camera',
    'videoquality',
  ];

  // أزرار الطالب: صوت + كاميرا اختيارية (تبدأ مطفأة، والطالب يشغلها بنفسه)
  const studentToolbarButtons = [
    'microphone',
    'camera',
    'raisehand',
    'chat',
    'fullscreen',
    'hangup',
    'settings',
  ];

  useEffect(() => {
    let isMounted = true;
    isDisposingRef.current = false;

    const loadJitsiScript = () => {
      return new Promise((resolve, reject) => {
        if (window.JitsiMeetExternalAPI) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = `https://${domain}/external_api.js`;
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error('تعذّر تحميل مكتبة Jitsi Meet'));
        document.body.appendChild(script);
      });
    };

    const initJitsi = async () => {
      try {
        await loadJitsiScript();

        if (!isMounted || !containerRef.current) return;

        // Clean up any existing instance without triggering onLeave
        isDisposingRef.current = true;
        if (jitsiApiRef.current) {
          try {
            jitsiApiRef.current.dispose();
          } catch (_) {}
          jitsiApiRef.current = null;
        }
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
        isDisposingRef.current = false;

        const options = {
          roomName: sanitizedRoomName,
          width: '100%',
          height: '100%',
          parentNode: containerRef.current,
          userInfo: {
            displayName: displayName,
            email: userEmail,
          },
          configOverwrite: {
            // تحسين 1: الطلاب يدخلون صامتين
            startWithAudioMuted: !isTeacher,
            // تحسين 4: دخول الكاميرا مطفأة دائماً، والتشغيل اليدوي حر للطالب
            startWithVideoMuted: !isTeacher,
            disableDeepLinking: true,
            disableThirdPartyRequests: true,
            enableNoisyMicDetection: false, // توفير استهلاك البطارية والمعالج على الهواتف
            p2p: { enabled: false }, // إجبار الاتصال عبر SFU لضمان ثبات اتصال الهواتف وشبكات 4G/5G
            prejoinPageEnabled: false,
            lobbyModeEnabled: false,
            enableWelcomePage: false,
            enableClosePage: false,
            defaultLanguage: 'ar',

            // تحسين دقة الفيديو لتناسب شاشات الهواتف وتمنع التقطيع والحرارة
            constraints: {
              video: {
                height: { ideal: 480, max: 720 },
              },
            },

            // Stage View: المعلم كبير في المنتصف والطلاب شريط جانبي
            // (في وضع التركيز: الشريط مخفي والمسرح مثبّت على المشرف)
            disableTileView: true,
            filmstrip: {
              disabled: focusMode ? true : false,
              minParticipantCountForFilmstrip: 2,
            },

            // تحسين 3: تفعيل كشف الضوضاء افتراضياً لوضوح التلاوة
            disableNS: false,
            noiseSuppression: {
              enabled: true,
            },

            // أزرار مختلفة حسب الدور
            toolbarButtons: isTeacher ? teacherToolbarButtons : studentToolbarButtons,
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            DEFAULT_BACKGROUND: '#111827',
            TOOLBAR_ALWAYS_VISIBLE: true,
            MOBILE_APP_PROMO: false,
            HIDE_DEEP_LINKING_LOGO: true,
            DISABLE_FOCUS_INDICATOR: true,
            // تحسين 4: إخفاء خلفية الفيديو للطلاب
            ...(!isTeacher && {
              DISABLE_VIDEO_BACKGROUND: true,
            }),
          },
        };

        const api = new window.JitsiMeetExternalAPI(domain, options);
        jitsiApiRef.current = api;

        // Focus mode: keep the moderator pinned on the student stage
        const participantsMap = new Map(); // displayName -> jitsiParticipantId

        api.addEventListener('participantJoined', (participant) => {
          participantsMap.set(participant.displayName, participant.id);
          // وضع التركيز: ثبّت المشرف على المسرح فور انضمامه (أو إن كان موجوداً)
          if (focusMode && participant.displayName) {
            const focus = focusParticipantName;
            const name = participant.displayName;
            if (name === focus || name.includes(focus) || focus.includes(name)) {
              try { api.executeCommand('setLargeVideoParticipant', participant.id); } catch (_) {}
            }
          }
        });

        api.addEventListener('participantLeft', (participant) => {
          for (const [name, id] of participantsMap.entries()) {
            if (id === participant.id) {
              participantsMap.delete(name);
              break;
            }
          }
        });

        // Expose plain Jitsi API (no recitation/camera helpers)
        if (onApiReady) {
          onApiReady(api);
        }

        api.addEventListener('readyToClose', () => {
          if (!isDisposingRef.current && isMounted && onLeave) onLeave();
        });

        api.addEventListener('videoConferenceLeft', () => {
          if (!isDisposingRef.current && isMounted && onLeave) onLeave();
        });

        setLoading(false);
      } catch (err) {
        console.error('Jitsi initialization error:', err);
        if (isMounted) {
          setError(err.message || 'حدث خطأ في تحميل البث المباشر');
          setLoading(false);
        }
      }
    };

    initJitsi();

    return () => {
      isMounted = false;
      isDisposingRef.current = true;
      if (jitsiApiRef.current) {
        try {
          jitsiApiRef.current.dispose();
        } catch (_) {}
        jitsiApiRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [sanitizedRoomName, domain, displayName, isTeacher]);

  if (error) {
    return (
      <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center p-6 rounded-2xl"
        style={{ background: '#0C0C1D', color: '#fff' }}>
        <span aria-hidden style={{
          width: 64, height: 64, borderRadius: 18, background: 'rgba(255,255,255,0.08)',
          color: '#C2410C', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        }}>
          <AlertTriangle size={30} />
        </span>
        <h3 className="text-lg font-bold mb-2">عذراً، فشل اتصال Jitsi</h3>
        <p className="text-sm text-center max-w-md mb-4" style={{ color: 'rgba(255,255,255,0.65)' }}>{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 rounded-xl font-bold text-sm"
          style={{ background: '#177B58', color: '#fff', border: 'none', cursor: 'pointer', minHeight: 48 }}
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-0 overflow-hidden flex flex-col"
      style={{ background: '#0C0C1D', borderRadius: 18 }}>
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center" style={{ background: '#0C0C1D', color: '#fff' }}>
          <div className="w-12 h-12 rounded-full animate-spin mb-4"
            style={{ border: '4px solid rgba(255,255,255,0.15)', borderTopColor: '#fff' }} aria-hidden />
          <p className="font-semibold text-sm animate-pulse">
            جارٍ تجهيز الغرفة المباشرة (Jitsi Meet)...
          </p>
          {!isTeacher && (
            <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
              تدخل والكاميرا مطفأة — شغلها من زر الكاميرا متى شئت
            </p>
          )}
        </div>
      )}
      <div ref={containerRef} style={{ width, height }} className="w-full h-full" />
    </div>
  );
}
