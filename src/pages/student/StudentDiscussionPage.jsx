import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MessageSquare, ShieldCheck, Loader2, RotateCcw, Sparkles, ChevronDown } from 'lucide-react';
import PageLayout from '../../components/shared/PageLayout';
import AutoGrowTextarea from '../../components/shared/AutoGrowTextarea';
import useKeyboardViewport from '../../hooks/useKeyboardViewport';
import useAuthStore from '../../store/authStore';
import useDiscussionStore from '../../store/discussionStore';
import { timeAgoAr, formatDateAr } from '../../utils/helpers';
import toast from 'react-hot-toast';
import '../../components/halaqa/halaqa.css';
import { HQ } from '../../components/halaqa/primitives';

const POLL_INTERVAL = 6000;

/* Day label for separators: اليوم / أمس / full Arabic date */
function dayLabel(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'اليوم';
  if (sameDay(d, yesterday)) return 'أمس';
  return formatDateAr(d, 'EEEE d MMMM');
}

export default function StudentDiscussionPage() {
  const { user } = useAuthStore();
  const { messages, isLoading, isSending, fetchMyThread, sendStudentMessage, reset } = useDiscussionStore();
  const [content, setContent] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [atBottom, setAtBottom] = useState(true);

  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const lastCountRef = useRef(0);
  const prevUserIdRef = useRef(null);

  useKeyboardViewport();

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

  // Track whether the user is reading history (scrolled up) so
  // polling never yanks them around. Pill appears instead.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
      setAtBottom(nearBottom);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Jump to bottom ONLY when messages actually arrive (not on every poll)
  useEffect(() => {
    const grew = messages.length > lastCountRef.current;
    lastCountRef.current = messages.length;
    if (!grew) return;
    if (atBottom) {
      bottomRef.current?.scrollIntoView({ behavior: messages.length <= 2 ? 'auto' : 'smooth' });
    }
  }, [messages, atBottom]);

  // When switching students the store resets; re-anchor.
  useEffect(() => {
    const id = user?._id || null;
    if (prevUserIdRef.current !== id) {
      prevUserIdRef.current = id;
      lastCountRef.current = messages.length;
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setAtBottom(true);
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    const text = content.trim();
    if (!text || isSending) return;

    try {
      setContent('');
      await sendStudentMessage(text);
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
    } catch {
      toast.error('تعذّر إرسال الرسالة، يرجى المحاولة مرة أخرى');
      setContent(text);
    }
  };

  // Group messages by day for separators
  let lastDay = null;

  return (
    <PageLayout>
      <div className="halaqa hq-chat-shell relative flex flex-col w-full max-w-4xl mx-auto overflow-hidden border border-[#E8E2D4] bg-white shadow-sm rounded-none sm:rounded-2xl">

        {/* Header */}
        <div className="bg-white border-b border-[#E8E2D4] px-3 py-2 sm:px-5 sm:py-3 flex items-center justify-between gap-2 flex-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-9 h-9 rounded-xl bg-[#E2EFE7] border border-[#177B58]/20 flex items-center justify-center flex-none text-[#177B58]"
            >
              <MessageSquare className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-[15px] sm:text-lg font-black text-[#2A2438] truncate leading-tight">
                المناقشة مع الإدارة
              </h1>
              <p className="hidden sm:block text-xs text-[#756E85] truncate">
                تواصل مباشر وخاص مع إدارة المنصة للاستفسار عن الحصص، الورد، والامتحانات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-none">
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#E2EFE7] text-[#0F5940] border border-[#177B58]/20">
              <ShieldCheck className="w-3 h-3" /> مباشر
            </span>
            <button
              type="button"
              onClick={() => loadThread(false)}
              title="تحديث الرسائل"
              aria-label="تحديث الرسائل"
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#FBF7EE] hover:bg-white active:bg-[#E8E2D4] border border-[#E8E2D4] text-[#2A2438] transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chat Messages Body */}
        <div
          ref={scrollRef}
          className="hq-chat-scroll flex-1 bg-[#FBF7EE] px-3 py-3 sm:px-5 sm:py-4 overflow-y-auto flex flex-col gap-1.5 min-h-0"
        >
          {isLoading && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center m-auto">
              <Loader2 className="w-7 h-7 animate-spin text-[#177B58]" />
              <span className="text-sm text-[#756E85]">جارٍ تحميل المحادثة...</span>
            </div>
          ) : loadError ? (
            <div className="text-center m-auto p-6 bg-white rounded-2xl border border-[#E8E2D4] max-w-sm">
              <p className="text-red-600 text-sm font-bold mb-3">تعذّر تحميل المحادثة مع الإدارة</p>
              <button
                type="button"
                onClick={() => loadThread(false)}
                className="px-4 py-2.5 rounded-xl bg-[#177B58] text-white text-sm font-bold min-h-[44px]"
              >
                إعادة المحاولة
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="m-auto max-w-md text-center bg-white border border-[#E8E2D4] rounded-2xl p-6 sm:p-7">
              <span className="w-12 h-12 rounded-2xl bg-[#E2EFE7] text-[#177B58] inline-flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6" />
              </span>
              <h2 className="text-base sm:text-lg font-black text-[#2A2438] mb-1.5">
                أهلاً بك يا {user?.firstName || 'طالبنا العزيز'}!
              </h2>
              <p className="text-sm text-[#756E85] leading-relaxed">
                هذه محادثتك الخاصة والمباشرة مع إدارة المنصة. اكتب أي استفسار حول جدولك الدراسي، الورد اليومي، أو أي مساعدة تحتاجها وسنرد عليك هنا فوراً.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = msg.senderRole === 'student' || msg.sender?._id === user?._id || msg.sender === user?._id;
              const prev = messages[idx - 1];
              const sameSender = prev && (prev.senderRole === msg.senderRole) && prev.sender?._id === msg.sender?._id;
              const day = dayLabel(msg.createdAt);
              const showDay = day !== lastDay;
              if (showDay) lastDay = day;
              const showMeta = !sameSender || showDay;

              return (
                <div key={msg._id || idx}>
                  {showDay && (
                    <div className="flex items-center gap-3 my-2" aria-hidden>
                      <span className="flex-1 h-px bg-[#E8E2D4]" />
                      <span className="text-[11px] font-bold text-[#756E85] bg-white border border-[#E8E2D4] rounded-full px-3 py-0.5">
                        {day}
                      </span>
                      <span className="flex-1 h-px bg-[#E8E2D4]" />
                    </div>
                  )}

                  <div
                    className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isMe ? 'self-end items-end' : 'self-start items-start'} ${showMeta ? 'mt-2' : 'mt-0.5'}`}
                  >
                    {showMeta ? (
                      <div className="flex items-center gap-1.5 mb-0.5 px-1 text-[11px]">
                        <span className={`font-bold ${isMe ? 'text-[#177B58]' : 'text-[#2A2438]'}`}>
                          {isMe ? 'أنت' : 'إدارة المنصة'}
                        </span>
                        <span className="text-[#756E85] text-[10px]">{timeAgoAr(msg.createdAt)}</span>
                      </div>
                    ) : null}

                    <div
                      className={`px-3.5 py-2 sm:px-4 sm:py-2.5 text-[15px] sm:text-[15px] leading-relaxed rounded-2xl shadow-sm break-words whitespace-pre-wrap ${
                        isMe
                          ? 'bg-[#177B58] text-white rounded-br-md'
                          : 'bg-white text-[#2A2438] border border-[#E8E2D4] rounded-bl-md'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Jump-to-latest (tiny corner FAB, only while reading history) */}
        {!atBottom && messages.length > 0 && !isLoading && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="hq-jump"
            aria-label="الانتقال لأحدث الرسائل"
            title="الانتقال لأحدث الرسائل"
          >
            <ChevronDown className="w-[18px] h-[18px]" />
          </button>
        )}

        {/* Input Bar */}
        <form
          onSubmit={handleSend}
          className="bg-white border-t border-[#E8E2D4] p-2.5 sm:p-3 flex items-end gap-2 flex-none"
        >
          <AutoGrowTextarea
            value={content}
            onChange={setContent}
            onSend={handleSend}
            placeholder="اكتب استفسارك لإدارة المنصة هنا..."
            disabled={isSending}
            className="flex-1"
          />

          <button
            type="submit"
            disabled={!content.trim() || isSending}
            aria-label="إرسال الرسالة"
            className={`flex-none w-11 h-11 rounded-xl font-bold text-sm flex items-center justify-center transition-all ${
              content.trim() && !isSending
                ? 'bg-[#177B58] hover:bg-[#0F5940] shadow-sm cursor-pointer'
                : 'bg-gray-300 opacity-60 cursor-default'
            }`}
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>

      </div>
    </PageLayout>
  );
}
