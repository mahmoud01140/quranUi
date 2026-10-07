import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MessageSquare, ShieldCheck, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import PageLayout from '../../components/shared/PageLayout';
import useAuthStore from '../../store/authStore';
import useDiscussionStore from '../../store/discussionStore';
import { timeAgoAr } from '../../utils/helpers';
import toast from 'react-hot-toast';
import '../../components/halaqa/halaqa.css';
import { HQ, HqBadge } from '../../components/halaqa/primitives';

const POLL_INTERVAL = 6000;

export default function StudentDiscussionPage() {
  const { user } = useAuthStore();
  const { messages, isLoading, isSending, fetchMyThread, sendStudentMessage, reset } = useDiscussionStore();
  const [content, setContent] = useState('');
  const [loadError, setLoadError] = useState(false);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);

  const loadThread = useCallback(async (silent = false) => {
    try {
      setLoadError(false);
      await fetchMyThread({ silent });
    } catch {
      if (!silent) setLoadError(true);
    }
  }, [fetchMyThread]);

  // Initial load + smart light polling (Vercel-safe HTTP polling)
  useEffect(() => {
    loadThread(false);

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadThread(true);
      }
    }, POLL_INTERVAL);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadThread(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      reset();
    };
  }, [loadThread, reset]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e?.preventDefault();
    const text = content.trim();
    if (!text || isSending) return;

    try {
      setContent('');
      await sendStudentMessage(text);
      inputRef.current?.focus();
    } catch {
      toast.error('تعذر إرسال الرسالة، يرجى المحاولة مرة أخرى');
      setContent(text);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <PageLayout>
      <div className="halaqa" style={{ maxWidth: 880, margin: '0 auto', minHeight: 'calc(100vh - 120px)', height: 'calc(100dvh - 120px)', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div
          style={{
            background: HQ.SURFACE,
            border: `1px solid ${HQ.LINE}`,
            borderRadius: '16px 16px 0 0',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            borderBottom: `1px solid ${HQ.LINE}`
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: HQ.MENTOR_WASH,
                border: `1px solid ${HQ.MENTOR}33`,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none',
              }}
            >
              <MessageSquare size={22} color={HQ.MENTOR} />
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: HQ.INK }}>
                  المناقشة مع الإدارة
                </h1>
                <HqBadge tone="mentor">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <ShieldCheck size={13} /> تواصل مباشر
                  </span>
                </HqBadge>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: HQ.MUTED }}>
                تواصل مباشر وخاص مع إدارة المنصة للاستفسار عن الحصص، الورد، الامتحانات، أو الدعم الفني
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadThread(false)}
            title="تحديث الرسائل"
            className="hq-action"
            style={{
              background: HQ.PAPER,
              border: `1px solid ${HQ.LINE}`,
              color: HQ.INK,
              padding: '0 12px',
              height: 36,
              fontSize: 13,
            }}
          >
            <RotateCcw size={14} /> <span className="m-hide-sm">تحديث</span>
          </button>
        </div>

        {/* Chat Messages Body */}
        <div
          ref={chatContainerRef}
          style={{
            flex: 1,
            background: HQ.PAPER,
            borderLeft: `1px solid ${HQ.LINE}`,
            borderRight: `1px solid ${HQ.LINE}`,
            padding: '20px 16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {isLoading && messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
              <Loader2 size={28} className="animate-spin" color={HQ.MENTOR} />
              <span style={{ fontSize: 14, color: HQ.MUTED }}>جارٍ تحميل المحادثة...</span>
            </div>
          ) : loadError ? (
            <div style={{ textAlign: 'center', margin: 'auto', padding: 24 }}>
              <p style={{ color: '#D9534F', fontSize: 15, marginBottom: 12 }}>تعذر تحميل المحادثة مع الإدارة</p>
              <button
                type="button"
                onClick={() => loadThread(false)}
                className="hq-action"
                style={{ background: HQ.MENTOR, color: '#fff', padding: '0 20px', fontSize: 14 }}
              >
                إعادة المحاولة
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div
              style={{
                margin: 'auto',
                maxWidth: 460,
                textAlign: 'center',
                background: HQ.SURFACE,
                border: `1px solid ${HQ.LINE}`,
                borderRadius: 16,
                padding: '28px 24px',
              }}
            >
              <span
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  background: HQ.MENTOR_WASH,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px',
                }}
              >
                <Sparkles size={24} color={HQ.MENTOR} />
              </span>
              <h2 style={{ fontSize: 17, fontWeight: 900, color: HQ.INK, margin: '0 0 8px' }}>
                أهلاً بك يا {user?.firstName || 'طالبنا العزيز'}!
              </h2>
              <p style={{ fontSize: 14, color: HQ.MUTED, lineHeight: 1.7, margin: 0 }}>
                هذه محادثتك الخاصة والمباشرة مع إدارة المنصة. يمكنك كتابة أي استفسار حول جدولك الدراسي، الورد اليومي، أو أي مساعدة تحتاجها، وسيقوم فريق الإدارة بالرد عليك ومتابعتك هنا مباشرة.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderRole === 'student' || msg.sender?._id === user?._id || msg.sender === user?._id;
              return (
                <div
                  key={msg._id || Math.random()}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isMe ? 'flex-end' : 'flex-start',
                    maxWidth: '82%',
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, padding: '0 4px' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: isMe ? HQ.MENTOR : HQ.INK }}>
                      {isMe ? 'أنت' : 'إدارة المنصة'}
                    </span>
                    <span style={{ fontSize: 10, color: HQ.MUTED }}>
                      {timeAgoAr(msg.createdAt)}
                    </span>
                  </div>

                  <div
                    style={{
                      background: isMe ? HQ.MENTOR : HQ.SURFACE,
                      color: isMe ? '#FFFFFF' : HQ.INK,
                      border: isMe ? 'none' : `1px solid ${HQ.LINE}`,
                      borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      padding: '12px 16px',
                      fontSize: 14,
                      lineHeight: 1.7,
                      wordBreak: 'break-word',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSend}
          style={{
            background: HQ.SURFACE,
            border: `1px solid ${HQ.LINE}`,
            borderRadius: '0 0 16px 16px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اكتب استفسارك أو رسالتك لإدارة المنصة هنا..."
            disabled={isSending}
            style={{
              flex: 1,
              background: HQ.PAPER,
              border: `1px solid ${HQ.LINE}`,
              borderRadius: 12,
              padding: '10px 16px',
              fontSize: 14,
              color: HQ.INK,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />

          <button
            type="submit"
            disabled={!content.trim() || isSending}
            className="hq-action"
            style={{
              background: content.trim() ? HQ.MENTOR : HQ.MUTED,
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 12,
              padding: '0 20px',
              height: 44,
              fontSize: 14,
              cursor: content.trim() && !isSending ? 'pointer' : 'default',
              opacity: content.trim() && !isSending ? 1 : 0.6,
            }}
          >
            {isSending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <Send size={16} /> <span>إرسال</span>
              </>
            )}
          </button>
        </form>

      </div>
    </PageLayout>
  );
}
