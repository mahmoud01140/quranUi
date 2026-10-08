import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MessageCircle, Send, Pin, Trash2, Reply, ChevronDown, X, AlertCircle, Loader2, ArrowRight, RefreshCw } from 'lucide-react';
import PageLayout from '../../components/shared/PageLayout';
import useAuthStore from '../../store/authStore';
import useDiscussionStore from '../../store/discussionStore';
import { timeAgoAr } from '../../utils/helpers';
import toast from 'react-hot-toast';
import '../../components/halaqa/halaqa.css';
import { HQ, HqAvatar, HqBadge } from '../../components/halaqa/primitives';

/* غرفة نقاش الدرس — room per lesson, visible to that lesson's group.
   Pure HTTP polling (6s), no socket.io — Vercel-safe. */

const POLL_MS = 6000;

export default function LessonDiscussionPage() {
  const { lessonId } = useParams();
  const { user } = useAuthStore();
  const {
    lessonTitle, groupId, groupName, messages, pinnedMessages, isLoading,
    fetchLessonDiscussion, sendLessonMessage, pinLessonMessage,
    deleteLessonMessage, reset,
  } = useDiscussionStore();

  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [showPinned, setShowPinned] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';
  const canModerate = isTeacher;
  const backTo = user?.role === 'admin'
    ? '/admin/users'
    : user?.role === 'teacher'
      ? '/teacher'
      : '/student/curriculum';

  const load = useCallback(async (silent = false) => {
    if (!lessonId) return;
    try {
      setLoadFailed(false);
      await fetchLessonDiscussion(lessonId, { silent });
    } catch {
      if (!silent) setLoadFailed(true);
    }
  }, [lessonId, fetchLessonDiscussion]);

  // Initial load + polling (paused when tab hidden)
  useEffect(() => {
    load(false);
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load(true);
    }, POLL_MS);
    const onVis = () => { if (document.visibilityState === 'visible') load(true); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      reset();
    };
  }, [load, reset]);

  // Auto-scroll when near bottom
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    setShowScrollBtn(!isNearBottom);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim() || isSending) return;
    setIsSending(true);
    setSendFailed(false);
    try {
      await sendLessonMessage(lessonId, input.trim(), replyTo?._id || null);
      setInput('');
      setReplyTo(null);
      inputRef.current?.focus();
      scrollToBottom();
    } catch {
      setSendFailed(true);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePin = async (msgId) => {
    try {
      await pinLessonMessage(lessonId, msgId);
    } catch {
      toast.error('فشل في تثبيت الرسالة');
    }
  };

  const handleDelete = async (msgId) => {
    try {
      await deleteLessonMessage(lessonId, msgId);
    } catch {
      toast.error('فشل في حذف الرسالة');
    }
  };

  if (!lessonId) {
    return (
      <PageLayout>
        <div className="halaqa" style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 48, textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
          <AlertCircle size={40} color={HQ.MUTED} style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 18, fontWeight: 900, color: HQ.INK, margin: '0 0 4px' }}>لم يتم تحديد الدرس</p>
          <p style={{ fontSize: 14, color: HQ.MUTED, margin: 0 }}>افتح النقاش من زر النقاش داخل الدرس.</p>
        </div>
      </PageLayout>
    );
  }

  const activePinned = (pinnedMessages || []).filter(m => m && !m.isDeleted);
  const iconBtn = {
    background: 'none', border: 'none', cursor: 'pointer', minWidth: 44, minHeight: 44,
    borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <PageLayout>
      <div className="halaqa flex flex-col w-full max-w-3xl mx-auto h-[calc(100dvh-170px)] sm:h-[calc(100dvh-150px)] lg:h-[calc(100dvh-130px)]">
        {/* Header */}
        <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: '12px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flex: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <Link to={backTo} aria-label="رجوع للدروس" style={{ ...iconBtn, flex: 'none' }}>
              <ArrowRight size={19} color={HQ.MENTOR} />
            </Link>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: HQ.MENTOR, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <MessageCircle size={19} color="#fff" />
            </span>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontWeight: 900, color: HQ.INK, fontSize: 18, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                نقاش: {lessonTitle || 'الدرس'}
              </h1>
              <p style={{ margin: 0, fontSize: 12, color: HQ.MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {groupId ? `${groupName} · مرئي لطلاب الحلقة فقط` : 'غرفة نقاش ومتابعة خاصة بين الطالب والمعلم'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
            <button type="button" onClick={() => load(false)} aria-label="تحديث النقاش" style={{ ...iconBtn }}>
              <RefreshCw size={17} color={HQ.MUTED} />
            </button>
            {activePinned.length > 0 && (
              <button type="button" onClick={() => setShowPinned(!showPinned)} aria-expanded={showPinned}
                style={{ ...iconBtn, width: 'auto', padding: '0 14px', gap: 6, background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, fontSize: 12, fontWeight: 800, color: HQ.INK }}>
                <Pin size={14} /> {activePinned.length} مثبتة
              </button>
            )}
          </div>
        </div>

        {/* Pinned panel */}
        {showPinned && activePinned.length > 0 && (
          <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 14, marginBottom: 10, overflow: 'hidden', flex: 'none' }}>
            <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${HQ.LINE}` }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 800, color: HQ.INK }}>
                <Pin size={15} /> المثبتة
              </span>
              <button type="button" onClick={() => setShowPinned(false)} aria-label="إخفاء المثبتة" style={{ ...iconBtn }}>
                <X size={17} color={HQ.MUTED} />
              </button>
            </div>
            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 150, overflowY: 'auto' }}>
              {activePinned.map((msg) => (
                <div key={msg._id} style={{ background: HQ.SURFACE, borderRadius: 10, padding: '8px 12px', fontSize: 14 }}>
                  <strong style={{ color: HQ.INK }}>{msg.sender?.firstName || 'مستخدم'}: </strong>
                  <span style={{ color: HQ.MUTED }}>{msg.content}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div ref={chatContainerRef} onScroll={handleScroll}
          style={{ flex: 1, overflowY: 'auto', background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: '12px 14px', position: 'relative' }}>
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: HQ.MUTED, fontSize: 14, fontWeight: 700 }}>
              <Loader2 size={20} className="animate-spin" /> جارٍ تحميل النقاش...
            </div>
          ) : loadFailed && messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: HQ.MUTED }}>
              <AlertCircle size={40} color={HQ.LINE} style={{ marginBottom: 12 }} />
              <p style={{ fontWeight: 800, fontSize: 16, color: HQ.INK, margin: '0 0 4px' }}>تعذّر تحميل النقاش</p>
              <p style={{ fontSize: 14, margin: '0 0 12px' }}>تحقق من الاتصال أو من صلاحية وصولك لهذا الدرس.</p>
              <button type="button" onClick={() => load(false)} className="hq-action"
                style={{ background: HQ.MENTOR, color: '#fff', padding: '0 20px', fontSize: 14 }}>
                <RefreshCw size={15} /> إعادة المحاولة
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: HQ.MUTED }}>
              <MessageCircle size={52} color={HQ.LINE} style={{ marginBottom: 12 }} />
              <p style={{ fontWeight: 800, fontSize: 16, color: HQ.INK, margin: '0 0 4px' }}>لا رسائل بعد في نقاش هذا الدرس</p>
              <p style={{ fontSize: 14, margin: 0 }}>كن أول من يسأل أو يشارك زملاء مجموعتك</p>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => {
                const isMine = msg.sender?._id === user?._id;
                const prevMsg = messages[idx - 1];
                const sameUser = prevMsg?.sender?._id === msg.sender?._id;
                const timeDiff = prevMsg
                  ? (new Date(msg.createdAt) - new Date(prevMsg.createdAt)) / 60000
                  : 999;
                const showHeader = !sameUser || timeDiff > 5;
                const isStaff = msg.sender?.role === 'teacher' || msg.sender?.role === 'admin';

                return (
                  <div key={msg._id} style={{ display: 'flex', justifyContent: isMine ? 'flex-start' : 'flex-end', marginTop: showHeader ? 14 : 3 }}>
                    <div style={{ maxWidth: '85%', minWidth: 0 }}>
                      {showHeader && !msg.isDeleted && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, justifyContent: isMine ? 'flex-start' : 'flex-end' }}>
                          <HqAvatar firstName={msg.sender?.firstName} lastName={msg.sender?.lastName} size={28} />
                          <span style={{ fontSize: 13, fontWeight: 800, color: HQ.INK }}>
                            {msg.sender?.firstName} {msg.sender?.lastName}
                          </span>
                          {isStaff && <HqBadge tone="guide">{msg.sender?.role === 'admin' ? 'المعلم والمدير' : 'معلم'}</HqBadge>}
                          <span style={{ fontSize: 11, color: HQ.MUTED }}>{timeAgoAr(msg.createdAt)}</span>
                        </div>
                      )}

                      {msg.replyTo && !msg.isDeleted && (
                        <div style={{ background: HQ.PAPER, borderRight: `2px solid ${HQ.LINE}`, borderRadius: 8, padding: '6px 10px', marginBottom: 4, fontSize: 12, color: HQ.MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {msg.replyToMessage?.content
                            ? `رد على ${msg.replyToMessage.senderName || 'رسالة'}: ${msg.replyToMessage.content}`
                            : 'رد على رسالة سابقة'}
                        </div>
                      )}

                      <div style={{
                        borderRadius: 16, padding: '10px 14px', fontSize: 14, lineHeight: 1.8,
                        overflowWrap: 'break-word', whiteSpace: 'pre-wrap',
                        background: msg.isDeleted ? HQ.PAPER : isMine ? HQ.MENTOR : HQ.PAPER,
                        color: msg.isDeleted ? HQ.MUTED : isMine ? '#fff' : HQ.INK,
                        border: !isMine && !msg.isDeleted ? `1px solid ${HQ.LINE}` : 'none',
                        fontStyle: msg.isDeleted ? 'italic' : 'normal',
                        outline: msg.isPinned && !msg.isDeleted ? `2px solid ${HQ.INK}` : 'none',
                      }}>
                        {msg.isPinned && !msg.isDeleted && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, color: '#B45309', marginBottom: 2 }}>
                            <Pin size={11} /> مثبتة
                          </span>
                        )}
                        <span style={{ display: 'block' }}>{msg.content}</span>
                      </div>

                      {/* Actions — always visible, never hover-only */}
                      {!msg.isDeleted && (
                        <div style={{ display: 'flex', gap: 2, marginTop: 2, justifyContent: isMine ? 'flex-start' : 'flex-end' }}>
                          <button type="button" aria-label="رد على الرسالة"
                            onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }} style={{ ...iconBtn, color: HQ.MUTED }}>
                            <Reply size={15} />
                          </button>
                          {canModerate && (
                            <button type="button" aria-label={msg.isPinned ? 'إلغاء التثبيت' : 'تثبيت الرسالة'} aria-pressed={msg.isPinned}
                              onClick={() => handlePin(msg._id)} style={{ ...iconBtn, color: msg.isPinned ? '#B45309' : HQ.MUTED }}>
                              <Pin size={15} />
                            </button>
                          )}
                          {(canModerate || isMine) && (
                            <button type="button" aria-label="حذف الرسالة"
                              onClick={() => handleDelete(msg._id)} style={{ ...iconBtn, color: HQ.MUTED }}>
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}

          {showScrollBtn && (
            <button type="button" onClick={scrollToBottom} aria-label="النزول لآخر الرسائل"
              style={{ position: 'sticky', bottom: 8, display: 'flex', margin: '8px auto 0', width: 44, height: 44, borderRadius: 9999, border: 'none', background: HQ.MENTOR, color: '#fff', cursor: 'pointer', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronDown size={20} />
            </button>
          )}
        </div>

        {/* Reply banner */}
        {replyTo && (
          <div style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: '8px 12px', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 13, color: HQ.MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              رد على {replyTo.sender?.firstName}: {replyTo.content}
            </span>
            <button type="button" onClick={() => setReplyTo(null)} aria-label="إلغاء الرد" style={{ ...iconBtn }}>
              <X size={16} color={HQ.MUTED} />
            </button>
          </div>
        )}

        {/* Failed state */}
        {sendFailed && (
          <p role="alert" style={{ margin: '6px 2px 0', fontSize: 13, fontWeight: 700, color: '#C2410C' }}>
            تعذّر الإرسال — تحقق من الاتصال وحاول مجددًا.
          </p>
        )}

        {/* Input */}
        <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, marginTop: 8, padding: 10, display: 'flex', alignItems: 'flex-end', gap: 8, flex: 'none' }}>
          <textarea ref={inputRef} value={input} rows={1} aria-label="اكتب رسالتك"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اكتب سؤالك أو مشاركتك عن هذا الدرس..."
            style={{ flex: 1, resize: 'none', background: HQ.PAPER, borderRadius: 12, border: 'none', padding: '12px 14px', fontSize: 16, color: HQ.INK, fontFamily: 'inherit', minHeight: 48, maxHeight: 120 }} />
          <button type="button" onClick={handleSend} disabled={!input.trim() || isSending} aria-label="إرسال"
            style={{
              flex: 'none', width: 48, height: 48, borderRadius: 12, border: 'none',
              background: input.trim() ? HQ.MENTOR : HQ.PAPER, color: input.trim() ? '#fff' : HQ.MUTED,
              cursor: input.trim() ? 'pointer' : 'not-allowed',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <Send size={18} style={{ transform: 'scaleX(-1)' }} />
          </button>
        </div>
      </div>
    </PageLayout>
  );
}
