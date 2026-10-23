import { lazy, Suspense } from 'react';
import JitsiMeeting from './JitsiMeeting';
import LoadingSpinner from './LoadingSpinner';

const WebRTCP2PMeeting = lazy(() => import('../live/WebRTCP2PMeeting'));
const DailyMeeting = lazy(() => import('../live/DailyMeeting'));
const AgoraMeeting = lazy(() => import('../live/AgoraMeeting'));

/**
 * LiveRoomAdapter
 * محول البث الذكي متعدد المزودين (Multi-Provider Live Video Adapter)
 * يختار المزود المحدد من قبل الأدمن في إعدادات المنصة:
 * - 'webrtc' => WebRTC Peer-to-Peer مباشر (مجاني تماماً وفائق السرعة للحصص الفردية)
 * - 'daily'  => Daily.co (باقة الـ 10,000 دقيقة)
 * - 'agora'  => Agora RTC (باقة الـ 10,000 دقيقة)
 * - 'jitsi'  => Jitsi Meet (الخيار الأصلي والاحتياطي المباشر)
 */
export default function LiveRoomAdapter({
  session,
  roomName,
  displayName = 'مستخدم',
  userEmail = '',
  isTeacher = false,
  focusParticipantName = '',
  onApiReady,
  onLeave,
  height = '100%',
  width = '100%',
}) {
  // تحديد المزود الفعال من بيانات الجلسة (افتراضياً: jitsi للحفاظ على الاستقرار الكامل)
  const provider =
    session?.effectiveProvider ||
    session?.liveProvider ||
    session?.providerConfig?.provider ||
    'jitsi';

  // 1. مزود WebRTC P2P (مجاني 100% وفائق الدقة للحصص الفردية 1-on-1)
  if (provider === 'webrtc') {
    if (!session?._id) {
      return <StageFallback text="جارٍ تهيئة بيانات الحصة..." />;
    }
    return (
      <Suspense fallback={<StageFallback text="جارٍ تهيئة اتصال WebRTC P2P..." />}>
        <WebRTCP2PMeeting
          sessionId={session._id}
          displayName={displayName}
          isTeacher={isTeacher}
          onLeave={onLeave}
        />
      </Suspense>
    );
  }

  // 2. مزود Daily.co
  if (provider === 'daily') {
    const dailyUrl = session?.dailyRoomUrl || session?.providerConfig?.dailyRoomUrl;
    return (
      <Suspense fallback={<StageFallback text="جارٍ فتح غرفة Daily.co..." />}>
        <DailyMeeting
          roomUrl={dailyUrl}
          displayName={displayName}
          onLeave={onLeave}
        />
      </Suspense>
    );
  }

  // 3. مزود Agora RTC
  if (provider === 'agora') {
    const agoraConfig = session?.providerConfig?.agora || {};
    return (
      <Suspense fallback={<StageFallback text="جارٍ الاتصال بشبكة Agora..." />}>
        <AgoraMeeting
          appId={agoraConfig.appId}
          channel={agoraConfig.channel || roomName}
          token={agoraConfig.token}
          displayName={displayName}
          isTeacher={isTeacher}
          onLeave={onLeave}
        />
      </Suspense>
    );
  }

  // 4. المزود الافتراضي الأصلي: Jitsi Meet (بدون أي تعديل)
  return (
    <JitsiMeeting
      roomName={roomName}
      displayName={displayName}
      userEmail={userEmail}
      isTeacher={isTeacher}
      focusParticipantName={focusParticipantName}
      onApiReady={onApiReady}
      onLeave={onLeave}
      height={height}
      width={width}
    />
  );
}

function StageFallback({ text }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0F172A] text-white">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}
