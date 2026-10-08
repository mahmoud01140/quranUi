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
      <div className="halaqa flex flex-col w-full max-w-4xl mx-auto h-[calc(100dvh-170px)] sm:h-[calc(100dvh-150px)] lg:h-[calc(100dvh-130px)] rounded-2xl sm:rounded-3xl overflow-hidden border border-[#E8E2D4] bg-white shadow-sm">
        
        {/* Header */}
        <div className="bg-white border-b border-[#E8E2D4] px-3.5 py-2.5 sm:px-5 sm:py-3.5 flex items-center justify-between gap-2.5 flex-none">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <span
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-[#E2EFE7] border border-[#177B58]/20 flex items-center justify-center flex-none text-[#177B58]"
            >
              <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-[#2A2438] truncate">
                  المناقشة مع الإدارة
                </h1>
                <span className="hidden xs:inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#E2EFE7] text-[#0F5940] border border-[#177B58]/20">
                  <ShieldCheck className="w-3 h-3" /> مباشر
                </span>
              </div>
              <p className="hidden sm:block text-xs text-[#756E85] mt-0.5 truncate">
                تواصل مباشر وخاص مع إدارة المنصة للاستفسار عن الحصص، الورد، والامتحانات
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadThread(false)}
            title="تحديث الرسائل"
            className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-[#FBF7EE] hover:bg-white border border-[#E8E2D4] text-[#2A2438] text-xs sm:text-sm font-bold transition-colors flex-none"
          >
            <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">تحديث</span>
          </button>
        </div>

        {/* Chat Messages Body */}
        <div
          ref={chatContainerRef}
          className="flex-1 bg-[#FBF7EE] p-3 sm:p-5 overflow-y-auto flex flex-col gap-3 min-h-0"
        >
          {isLoading && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center my-auto">
              <Loader2 className="w-7 h-7 animate-spin text-[#177B58]" />
              <span className="text-xs sm:text-sm text-[#756E85]">جارٍ تحميل المحادثة...</span>
            </div>
          ) : loadError ? (
            <div className="text-center m-auto p-4 sm:p-6 bg-white rounded-2xl border border-[#E8E2D4] max-w-sm">
              <p className="text-red-600 text-sm font-bold mb-3">تعذر تحميل المحادثة مع الإدارة</p>
              <button
                type="button"
                onClick={() => loadThread(false)}
                className="px-4 py-2 rounded-xl bg-[#177B58] text-white text-xs sm:text-sm font-bold"
              >
                إعادة المحاولة
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="m-auto max-w-md text-center bg-white border border-[#E8E2D4] rounded-2xl p-5 sm:p-7 shadow-xs">
              <span className="w-12 h-12 rounded-2xl bg-[#E2EFE7] text-[#177B58] inline-flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6" />
              </span>
              <h2 className="text-base sm:text-lg font-black text-[#2A2438] mb-1.5">
                أهلاً بك يا {user?.firstName || 'طالبنا العزيز'}!
              </h2>
              <p className="text-xs sm:text-sm text-[#756E85] leading-relaxed">
                هذه محادثتك الخاصة والمباشرة مع إدارة المنصة. يمكنك كتابة أي استفسار حول جدولك الدراسي، الورد اليومي، أو أي مساعدة تحتاجها وسنرد عليك هنا فوراً.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderRole === 'student' || msg.sender?._id === user?._id || msg.sender === user?._id;
              return (
                <div
                  key={msg._id || Math.random()}
                  className={`flex flex-col max-w-[88%] sm:max-w-[78%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px]">
                    <span className={`font-bold ${isMe ? 'text-[#177B58]' : 'text-[#2A2438]'}`}>
                      {isMe ? 'أنت' : 'إدارة المنصة'}
                    </span>
                    <span className="text-[#756E85] text-[10px]">
                      {timeAgoAr(msg.createdAt)}
                    </span>
                  </div>

                  <div
                    className={`px-3.5 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm leading-relaxed rounded-2xl shadow-xs break-words ${
                      isMe
                        ? 'bg-[#177B58] text-white rounded-bl-xs'
                        : 'bg-white text-[#2A2438] border border-[#E8E2D4] rounded-br-xs'
                    }`}
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
          className="bg-white border-t border-[#E8E2D4] p-2.5 sm:p-3.5 flex items-center gap-2 flex-none"
        >
          <input
            ref={inputRef}
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اكتب استفسارك لإدارة المنصة هنا..."
            disabled={isSending}
            className="flex-1 bg-[#FBF7EE] border border-[#E8E2D4] focus:border-[#177B58] focus:bg-white rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm text-[#2A2438] outline-none transition-all placeholder:text-[#756E85]"
          />

          <button
            type="submit"
            disabled={!content.trim() || isSending}
            className={`flex-none h-10 px-3.5 sm:px-5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all text-white ${
              content.trim() && !isSending
                ? 'bg-[#177B58] hover:bg-[#0F5940] shadow-sm cursor-pointer'
                : 'bg-gray-300 opacity-60 cursor-default'
            }`}
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">إرسال</span>
              </>
            )}
          </button>
        </form>

      </div>
    </PageLayout>
  );
}
