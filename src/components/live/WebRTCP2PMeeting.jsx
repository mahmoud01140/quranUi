import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Maximize2, Minimize2, MonitorUp, Wifi,
  Volume2, X, RefreshCw
} from 'lucide-react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

// إنشاء مسار صوتي صامت اصطناعي لضمان وجود مسار وسائط في عرض WebRTC
const createSyntheticAudioStream = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return new MediaStream();
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const dst = ctx.createMediaStreamDestination();
    osc.connect(dst);
    osc.start();
    const track = dst.stream.getAudioTracks()[0];
    if (track) {
      track.enabled = false;
      return new MediaStream([track]);
    }
  } catch (_) {}
  return new MediaStream();
};

// إنشاء مسار فيديو بديل أنيق (Canvas Track)
// يضمن هذا المسار وجود قسم m=video في عرض WebRTC SDP دائماً
// مما يتيح استقبال فيديو الطرف الآخر حتى لو كانت كاميرا هذا الجهاز محجوزة أو مغلقة
const createPlaceholderVideoTrack = (name = 'مستخدم') => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    let frame = 0;
    const draw = () => {
      frame++;
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#0a0f1d');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const pulse = Math.sin(frame * 0.1) * 5;
      ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
      ctx.beginPath();
      ctx.arc(320, 160, 54 + pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(320, 160, 46, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px Arial, Tahoma, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const initial = (name || 'م')[0];
      ctx.fillText(initial, 320, 160);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 18px Arial, Tahoma, sans-serif';
      ctx.fillText(name || 'مستخدم', 320, 240);
    };

    draw();
    const interval = setInterval(draw, 500);
    const stream = canvas.captureStream ? canvas.captureStream(5) : canvas.mozCaptureStream?.(5);
    const track = stream?.getVideoTracks()?.[0];
    if (track) {
      const origStop = track.stop.bind(track);
      track.stop = () => {
        clearInterval(interval);
        origStop();
      };
      return track;
    }
  } catch (err) {
    console.warn('Placeholder video track error:', err);
  }
  return null;
};

// تحميل PeerJS ديناميكياً من CDN
const loadPeerScript = () => {
  return new Promise((resolve, reject) => {
    if (window.Peer) {
      resolve(window.Peer);
      return;
    }
    const existing = document.getElementById('peerjs-sdk-script');
    if (existing) {
      if (window.Peer) {
        resolve(window.Peer);
        return;
      }
      existing.addEventListener('load', () => resolve(window.Peer));
      existing.addEventListener('error', () => reject(new Error('Failed to load PeerJS')));
      return;
    }
    const script = document.createElement('script');
    script.id = 'peerjs-sdk-script';
    script.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
    script.async = true;
    script.onload = () => {
      if (window.Peer) {
        resolve(window.Peer);
      } else {
        reject(new Error('PeerJS window object not found'));
      }
    };
    script.onerror = () => {
      const fallback = document.createElement('script');
      fallback.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
      fallback.async = true;
      fallback.onload = () => {
        if (window.Peer) {
          resolve(window.Peer);
        } else {
          reject(new Error('PeerJS fallback load failed'));
        }
      };
      fallback.onerror = () => reject(new Error('Could not load PeerJS from CDNs'));
      document.body.appendChild(fallback);
    };
    document.body.appendChild(script);
  });
};

export default function WebRTCP2PMeeting({
  sessionId,
  displayName = 'مستخدم',
  isTeacher = false,
  onLeave,
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const containerRef = useRef(null);

  const peerRef = useRef(null);
  const currentCallRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const callRetryTimerRef = useRef(null);

  const [connectionStatus, setConnectionStatus] = useState('initializing'); // 'initializing' | 'waiting' | 'connecting' | 'connected' | 'disconnected'
  const [micMuted, setMicMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(!isTeacher);
  const [screenSharing, setScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [noticeMsg, setNoticeMsg] = useState(null);
  const [needsUserClickToPlay, setNeedsUserClickToPlay] = useState(false);

  const isConnectedRef = useRef(false);

  // تنظيف معرف الجلسة ليكون متوافقاً مع شبكة الإشارات
  const cleanId = (sessionId || 'session')
    .toString()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase();

  const myPeerId = `qp_${cleanId}_${isTeacher ? 'teacher' : 'student'}`;
  const targetPeerId = `qp_${cleanId}_${isTeacher ? 'student' : 'teacher'}`;

  // ربط مسار الفيديو البعيد وتشغيله مع حل لمشكلة حظر Autoplay
  const handleRemoteStream = useCallback((stream) => {
    if (!stream) return;
    isConnectedRef.current = true;
    setConnectionStatus('connected');

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;

      const playPromise = remoteVideoRef.current.play?.();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // تشغيل الفيديو بوضع كتم الصوت مؤقتاً لتظهر الصورة فوراً للمستخدم بدون حظر المتصفح
          if (remoteVideoRef.current) {
            remoteVideoRef.current.muted = true;
            remoteVideoRef.current.play?.().then(() => {
              setNeedsUserClickToPlay(true);
            }).catch(() => {
              setNeedsUserClickToPlay(true);
            });
          }
        });
      }
    }
  }, []);

  // دعم استلام المسارات
  const attachEventTracks = useCallback((eventOrStream) => {
    let stream = null;
    if (eventOrStream instanceof MediaStream) {
      stream = eventOrStream;
    } else if (eventOrStream?.streams && eventOrStream.streams[0]) {
      stream = eventOrStream.streams[0];
    } else if (eventOrStream?.track) {
      if (remoteStreamRef.current) {
        if (!remoteStreamRef.current.getTracks().some(t => t.id === eventOrStream.track.id)) {
          remoteStreamRef.current.addTrack(eventOrStream.track);
        }
        stream = remoteStreamRef.current;
      } else {
        stream = new MediaStream([eventOrStream.track]);
        remoteStreamRef.current = stream;
      }
    }
    if (stream) {
      handleRemoteStream(stream);
    }
  }, [handleRemoteStream]);

  // إنشاء مسار وسائط مكتمل (صوت + فيديو) في حال عدم توفر كاميرا أو ميكروفون
  const getOrCreateStream = useCallback(() => {
    if (localStreamRef.current && localStreamRef.current.getTracks().length > 0) {
      return localStreamRef.current;
    }
    const syntheticAudio = createSyntheticAudioStream();
    const placeholderVideo = createPlaceholderVideoTrack(displayName);
    const tracks = [...syntheticAudio.getTracks()];
    if (placeholderVideo) tracks.push(placeholderVideo);
    const synthetic = new MediaStream(tracks);
    localStreamRef.current = synthetic;
    return synthetic;
  }, [displayName]);

  // تهيئة الوسائط المحلية مع حماية كاملة ضد قفل الكاميرا
  const initLocalMedia = useCallback(async () => {
    let stream = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
    } catch (_) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
      } catch (__) {
        setMicMuted(true);
      }
    }

    if (!stream) {
      stream = new MediaStream();
    }
    if (stream.getAudioTracks().length === 0) {
      const syntheticAudio = createSyntheticAudioStream();
      syntheticAudio.getAudioTracks().forEach(t => stream.addTrack(t));
    }

    // إضافة مسار فيديو بديل لضمان احتواء عرض SDP على m=video دائماً
    if (stream.getVideoTracks().length === 0) {
      const placeholderVideo = createPlaceholderVideoTrack(displayName);
      if (placeholderVideo) {
        stream.addTrack(placeholderVideo);
      }
    }

    localStreamRef.current = stream;

    if (stream) {
      if (!isTeacher) {
        stream.getVideoTracks().forEach((t) => (t.enabled = false));
        setVideoOff(true);
      } else {
        setVideoOff(false);
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play?.().catch(() => {});
      }
    }

    return stream;
  }, [displayName, isTeacher]);

  // الاتصال بالطرف الآخر
  const makeCall = useCallback((peer, stream) => {
    if (!peer || peer.destroyed || isConnectedRef.current) return;
    const mediaStream = stream || getOrCreateStream();

    setConnectionStatus((prev) => (prev === 'connected' ? 'connected' : 'connecting'));

    try {
      const call = peer.call(targetPeerId, mediaStream);
      if (!call) return;
      currentCallRef.current = call;

      call.on('stream', (remoteStream) => {
        attachEventTracks(remoteStream);
      });

      if (call.peerConnection) {
        call.peerConnection.oniceconnectionstatechange = () => {
          const st = call.peerConnection.iceConnectionState;
          if (st === 'connected' || st === 'completed') {
            isConnectedRef.current = true;
            setConnectionStatus('connected');
          }
        };

        call.peerConnection.ontrack = (event) => {
          attachEventTracks(event);
        };
      }

      call.on('close', () => {
        isConnectedRef.current = false;
        setConnectionStatus('waiting');
      });

      call.on('error', () => {
        if (!isConnectedRef.current) {
          setConnectionStatus('waiting');
        }
      });
    } catch (_) {}
  }, [targetPeerId, getOrCreateStream, attachEventTracks]);

  // إعداد كائن PeerJS
  useEffect(() => {
    let isMounted = true;

    const startPeerConnection = async () => {
      try {
        const PeerClass = await loadPeerScript();
        if (!isMounted) return;

        const stream = await initLocalMedia();
        if (!isMounted) return;

        const peer = new PeerClass(myPeerId, {
          config: ICE_SERVERS,
          debug: 0,
        });

        peerRef.current = peer;

        peer.on('open', () => {
          if (!isMounted) return;
          setConnectionStatus('waiting');

          if (!isTeacher) {
            makeCall(peer, stream);
          }
        });

        // استقبال المكالمات الواردة
        peer.on('call', (call) => {
          if (!isMounted) return;
          currentCallRef.current = call;
          setConnectionStatus('connecting');

          const mediaStream = localStreamRef.current || getOrCreateStream();
          call.answer(mediaStream);

          call.on('stream', (remoteStream) => {
            if (!isMounted) return;
            attachEventTracks(remoteStream);
          });

          if (call.peerConnection) {
            call.peerConnection.oniceconnectionstatechange = () => {
              const st = call.peerConnection.iceConnectionState;
              if (st === 'connected' || st === 'completed') {
                isConnectedRef.current = true;
                setConnectionStatus('connected');
              }
            };
            call.peerConnection.ontrack = (event) => {
              if (isMounted) attachEventTracks(event);
            };
          }

          call.on('close', () => {
            if (!isMounted) return;
            isConnectedRef.current = false;
            setConnectionStatus('waiting');
          });
        });

        peer.on('error', (err) => {
          if (err.type === 'peer-unavailable') {
            if (!isConnectedRef.current && isMounted) {
              setConnectionStatus('waiting');
            }
            return;
          }
          if (err.type === 'unavailable-id') {
            setTimeout(() => {
              if (isMounted && (!peerRef.current || peerRef.current.destroyed)) {
                startPeerConnection();
              }
            }, 1500);
            return;
          }
        });

        peer.on('disconnected', () => {
          if (!isMounted) return;
          isConnectedRef.current = false;
          setConnectionStatus('disconnected');
          peer.reconnect();
        });

        // إعادة تجربة الاتصال تلقائياً كل 3.5 ثوانٍ طالما لم يتم الاتصال بعد
        if (!isTeacher) {
          callRetryTimerRef.current = setInterval(() => {
            if (isMounted && peerRef.current && !peerRef.current.destroyed) {
              if (!isConnectedRef.current) {
                makeCall(peerRef.current, localStreamRef.current);
              }
            }
          }, 3500);
        }
      } catch (err) {
        if (isMounted) {
          setNoticeMsg('تعذر تهيئة الاتصال المباشر. يرجى التحقق من اتصال الإنترنت.');
          setConnectionStatus('disconnected');
        }
      }
    };

    startPeerConnection();

    return () => {
      isMounted = false;
      isConnectedRef.current = false;
      if (callRetryTimerRef.current) clearInterval(callRetryTimerRef.current);
      if (currentCallRef.current) currentCallRef.current.close();
      if (peerRef.current) peerRef.current.destroy();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [myPeerId, targetPeerId, isTeacher, initLocalMedia, makeCall, getOrCreateStream, attachEventTracks]);

  // إعادة المحاولة يدوياً
  const handleReconnect = () => {
    if (peerRef.current && !peerRef.current.destroyed) {
      makeCall(peerRef.current, localStreamRef.current);
    }
  };

  // التحكم بالصوت
  const toggleMic = () => {
    if (!localStreamRef.current) return;
    const next = !micMuted;
    localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMicMuted(next);
  };

  // التحكم بالكاميرا
  const toggleVideo = async () => {
    if (!localStreamRef.current) return;
    const tracks = localStreamRef.current.getVideoTracks();

    if (videoOff) {
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const realTrack = camStream.getVideoTracks()[0];

        if (currentCallRef.current?.peerConnection) {
          const sender = currentCallRef.current.peerConnection.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            await sender.replaceTrack(realTrack);
          }
        }

        tracks.forEach(t => {
          localStreamRef.current.removeTrack(t);
          t.stop();
        });
        localStreamRef.current.addTrack(realTrack);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
          localVideoRef.current.play?.().catch(() => {});
        }
        setVideoOff(false);
      } catch (_) {
        tracks.forEach(t => (t.enabled = true));
        setVideoOff(false);
      }
    } else {
      tracks.forEach(t => (t.enabled = false));
      setVideoOff(true);
    }
  };

  // مشاركة الشاشة
  const toggleScreenShare = async () => {
    if (!currentCallRef.current?.peerConnection) return;
    const pc = currentCallRef.current.peerConnection;

    if (screenSharing) {
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = camStream.getVideoTracks()[0];
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack);
        if (localVideoRef.current) localVideoRef.current.srcObject = camStream;
        setScreenSharing(false);
      } catch (_) {}
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack);
        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
        setScreenSharing(true);

        screenTrack.onended = () => {
          toggleScreenShare();
        };
      } catch (_) {}
    }
  };

  // ملء الشاشة
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const isConnected = connectionStatus === 'connected';

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex flex-col bg-[#070B14] text-white overflow-hidden select-none"
      dir="rtl"
    >
      {/* تنبيه تحذيري عند الحاجة */}
      {noticeMsg && (
        <div className="absolute top-14 right-3 left-3 z-30 flex items-center justify-between gap-2 p-2.5 px-3.5 bg-amber-950/85 border border-amber-600/50 rounded-xl text-amber-200 text-xs shadow-lg backdrop-blur-md">
          <span>{noticeMsg}</span>
          <button
            onClick={() => setNoticeMsg(null)}
            className="p-1 hover:bg-white/10 rounded-lg shrink-0 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* شريط الحالة بالأعلى */}
      <div className="absolute top-3 right-3 left-3 z-20 flex items-center justify-between pointer-events-none gap-2">
        <div className="flex items-center gap-2 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs font-semibold shadow-md pointer-events-auto">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected
                ? 'bg-emerald-400 animate-pulse'
                : connectionStatus === 'connecting'
                ? 'bg-amber-400 animate-spin'
                : 'bg-slate-400'
            }`}
          />
          <Wifi size={13} className={isConnected ? 'text-emerald-400' : 'text-amber-400'} />
          <span className="truncate max-w-[200px] sm:max-w-none text-xs">
            {isConnected
              ? 'متصل مباشر'
              : connectionStatus === 'connecting'
              ? 'جارٍ الاتصال...'
              : 'في انتظار الطرف الآخر...'}
          </span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {!isConnected && (
            <button
              onClick={handleReconnect}
              className="bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 border border-white/15 transition-all shadow-sm cursor-pointer"
              title="إعادة محاولة الربط"
            >
              <RefreshCw size={12} />
              <span className="hidden sm:inline">إعادة المحاولة</span>
            </button>
          )}

          <div className="bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs text-slate-300 shadow-md">
            {displayName} {isTeacher ? '(المعلم)' : '(الطالب)'}
          </div>
        </div>
      </div>

      {/* شاشة الفيديو الرئيسية */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center bg-[#070B14] overflow-hidden">
        {/* الفيديو البعيد */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-contain"
        />

        {/* زر تشغيل الصوت في حال حظر المتصفح للـ Autoplay */}
        {needsUserClickToPlay && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-xs">
            <button
              onClick={() => {
                if (remoteVideoRef.current) {
                  remoteVideoRef.current.muted = false;
                  remoteVideoRef.current.play?.().then(() => {
                    setNeedsUserClickToPlay(false);
                  }).catch(() => {
                    setNeedsUserClickToPlay(false);
                  });
                }
              }}
              className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center gap-2 shadow-2xl transition-all cursor-pointer animate-pulse"
            >
              <Volume2 size={22} />
              <span>انقر هنا لتشغيل واستماع صوت البث المباشر 🔊</span>
            </button>
          </div>
        )}

        {/* شاشة الانتظار النظيفة حتى اكتمال الاتصال */}
        {!isConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070B14] p-4 text-center z-10">
            <div className="w-12 h-12 rounded-full border-3 border-emerald-500/20 border-t-emerald-500 animate-spin mb-4" />
            <p className="text-base font-bold text-white mb-2">
              {connectionStatus === 'connecting'
                ? 'جارٍ فتح بث الفيديو المباشر...'
                : isTeacher
                ? 'في انتظار دخول الطالب للحصة المباشرة...'
                : 'في انتظار بدء المعلم للبث وانضمامه للحصة...'}
            </p>
            <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">
              اتصال مباشر ومشفر عالي الدقة (Peer-to-Peer). سيبدأ البث تلقائياً فور انضمام الطرفين.
            </p>
            <button
              onClick={handleReconnect}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>تحديث الاتصال</span>
            </button>
          </div>
        )}

        {/* الكاميرا المحلية المصغرة (PiP) */}
        <div className="absolute bottom-20 left-3 sm:left-4 z-20 w-32 sm:w-44 aspect-video rounded-xl overflow-hidden shadow-2xl border-2 border-white/20 bg-slate-900">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${videoOff ? 'hidden' : 'block'}`}
          />
          {videoOff && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-400 text-xs font-bold gap-1">
              <VideoOff size={15} />
              <span className="text-[11px]">الكاميرا مطفأة</span>
            </div>
          )}
          <span className="absolute bottom-1 right-2 text-[10px] bg-black/75 px-1.5 py-0.5 rounded text-white font-medium">
            أنت
          </span>
        </div>
      </div>

      {/* شريط التحكم السفلي */}
      <div className="relative z-30 h-16 bg-slate-950/90 backdrop-blur-md border-t border-white/10 px-4 flex items-center justify-center gap-3">
        {/* الميكروفون */}
        <button
          onClick={toggleMic}
          className={`p-3 rounded-full transition-all cursor-pointer ${
            micMuted
              ? 'bg-rose-600 text-white hover:bg-rose-700'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          title={micMuted ? 'تشغيل الميكروفون' : 'كتم الميكروفون'}
        >
          {micMuted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        {/* الكاميرا */}
        <button
          onClick={toggleVideo}
          className={`p-3 rounded-full transition-all cursor-pointer ${
            videoOff
              ? 'bg-rose-600 text-white hover:bg-rose-700'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          title={videoOff ? 'تشغيل الكاميرا' : 'إيقاف الكاميرا'}
        >
          {videoOff ? <VideoOff size={18} /> : <Video size={18} />}
        </button>

        {/* مشاركة الشاشة (للمعلم غالباً) */}
        {isTeacher && (
          <button
            onClick={toggleScreenShare}
            className={`p-3 rounded-full transition-all cursor-pointer ${
              screenSharing
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            title={screenSharing ? 'إيقاف مشاركة الشاشة' : 'مشاركة الشاشة / المصحف'}
          >
            <MonitorUp size={18} />
          </button>
        )}

        {/* ملء الشاشة */}
        <button
          onClick={toggleFullscreen}
          className="p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all hidden sm:block cursor-pointer"
          title="ملء الشاشة"
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>

        {/* إنهاء المكالمة */}
        <button
          onClick={() => {
            if (onLeave) onLeave();
          }}
          className="p-2.5 px-4 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
          title="إنهاء المكالمة"
        >
          <PhoneOff size={16} />
          <span className="text-xs">إنهاء</span>
        </button>
      </div>
    </div>
  );
}
