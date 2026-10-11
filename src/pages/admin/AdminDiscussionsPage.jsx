import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, Search, Send, ChevronRight, ChevronDown,
  Loader2, RotateCcw, Phone, Mail,
} from 'lucide-react';
import PageLayout from '../../components/shared/PageLayout';
import AutoGrowTextarea from '../../components/shared/AutoGrowTextarea';
import useKeyboardViewport from '../../hooks/useKeyboardViewport';
import useDiscussionStore from '../../store/discussionStore';
import { timeAgoAr, getInitials, getAvatarColor, getLevelLabel, formatDateAr } from '../../utils/helpers';
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

export default function AdminDiscussionsPage() {
  const {
    conversations,
    currentStudent,
    messages,
    isLoading,
    isSending,
    fetchAdminConversations,
    fetchAdminStudentThread,
    sendAdminReply,
    reset,
  } = useDiscussionStore();

  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [searchInput, setSearchInput] = useState('');   // what the admin is typing
  const [searchQuery, setSearchQuery] = useState('');   // debounced value hitting the API
  const [replyText, setReplyText] = useState('');
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'chat'
  const [atBottom, setAtBottom] = useState(true);

  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const lastCountRef = useRef(0);
  const lastStudentRef = useRef(null);

  useKeyboardViewport();

  // Debounce search: one API call per pause in typing, not per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Load conversations list
  const loadConversations = useCallback(async (q) => {
    try {
      await fetchAdminConversations(q ?? searchQuery);
    } catch {
      // silently ignore polling errors
    }
  }, [fetchAdminConversations, searchQuery]);

  // Load messages for currently selected student
  const loadStudentChat = useCallback(async (studentId, silent = false) => {
    if (!studentId) return;
    try {
      await fetchAdminStudentThread(studentId, { silent });
    } catch {
      // silently ignore polling errors
    }
  }, [fetchAdminStudentThread]);

  // Initial load + interval polling
  useEffect(() => {
    loadConversations(searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadConversations();
        if (selectedStudentId) {
          loadStudentChat(selectedStudentId, true);
        }
      }
    }, POLL_INTERVAL);

    return () => {
      clearInterval(timer);
      reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadConversations, loadStudentChat, selectedStudentId]);

  // Select first conversation if none selected on desktop
  useEffect(() => {
    if (!selectedStudentId && conversations.length > 0 && window.innerWidth >= 768) {
      const firstId = conversations[0].student?._id;
      if (firstId) {
        setSelectedStudentId(firstId);
        loadStudentChat(firstId, false);
      }
    }
  }, [conversations, selectedStudentId, loadStudentChat]);

  // Track scroll position so polling never yanks the admin mid-read.
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

  // Jump to bottom ONLY on real growth or student switch — not every poll.
  useEffect(() => {
    const studentChanged = lastStudentRef.current !== selectedStudentId;
    const grew = messages.length > lastCountRef.current;
    lastStudentRef.current = selectedStudentId;
    lastCountRef.current = messages.length;
    if (!grew && !studentChanged) return;
    const behavior = studentChanged || messages.length <= 2 ? 'auto' : 'smooth';
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior }));
    setAtBottom(true);
  }, [messages, selectedStudentId]);

  const handleSelectStudent = (studentId) => {
    setSelectedStudentId(studentId);
    setMobileView('chat');
    loadStudentChat(studentId, false);
  };

  const handleSendReply = async (e) => {
    e?.preventDefault();
    const text = replyText.trim();
    if (!text || !selectedStudentId || isSending) return;

    try {
      setReplyText('');
      await sendAdminReply(selectedStudentId, text);
      inputRef.current?.focus();
      loadConversations();
    } catch {
      toast.error('تعذّر إرسال الرد، يرجى المحاولة ثانية');
      setReplyText(text);
    }
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setAtBottom(true);
  };

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadByAdminCount || 0), 0);

  let lastDay = null;

  return (
    <PageLayout>
      <div className="halaqa hq-chat-shell relative flex flex-col w-full max-w-6xl mx-auto overflow-hidden border border-[#E8E2D4] bg-white shadow-sm rounded-none sm:rounded-2xl">

        {/* Top Bar */}
        <div className="bg-white border-b border-[#E8E2D4] px-3 py-2 sm:px-5 sm:py-3 flex items-center justify-between gap-2 flex-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-9 h-9 rounded-xl bg-[#E2EFE7] border border-[#177B58]/20 flex items-center justify-center flex-none text-[#177B58]"
            >
              <MessageSquare className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-[15px] sm:text-lg font-black text-[#2A2438] truncate leading-tight">
                  رسائل ومناقشات الطلاب
                </h1>
                {totalUnread > 0 && (
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex-none">
                    {totalUnread} غير مقروء
                  </span>
                )}
              </div>
              <p className="hidden sm:block text-xs text-[#756E85] truncate">
                تواصل مباشر ودعم فوري فردي مع كل طالب في المنصة بدون وسطاء
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              loadConversations();
              if (selectedStudentId) loadStudentChat(selectedStudentId, false);
            }}
            title="تحديث"
            aria-label="تحديث"
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#FBF7EE] hover:bg-white active:bg-[#E8E2D4] border border-[#E8E2D4] text-[#2A2438] transition-colors flex-none"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Main 2-Column Content */}
        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* Column 1: Conversations List */}
          <div
            className={`w-full md:w-80 md:min-w-[280px] lg:w-96 flex flex-col bg-white border-l border-[#E8E2D4] overflow-hidden ${
              mobileView === 'chat' ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* Search Box */}
            <div className="p-3 border-b border-[#E8E2D4] flex-none">
              <div className="relative">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#756E85] pointer-events-none" />
                <input
                  type="search"
                  inputMode="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="ابحث باسم الطالب أو بريده..."
                  className="w-full h-10 bg-[#FBF7EE] border border-[#E8E2D4] focus:border-[#177B58] focus:bg-white rounded-xl pr-9 pl-3 text-[15px] text-[#2A2438] outline-none transition-colors placeholder:text-[#756E85]"
                />
              </div>
            </div>

            {/* List */}
            <div className="hq-chat-scroll flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="text-center px-4 py-10 text-[#756E85] text-sm">
                  {isLoading ? 'جارٍ التحميل...' : 'لا توجد محادثات حتى الآن'}
                </div>
              ) : (
                conversations.map((conv) => {
                  const student = conv.student;
                  const isSelected = selectedStudentId === student?._id;
                  const hasUnread = (conv.unreadByAdminCount || 0) > 0;

                  return (
                    <button
                      type="button"
                      key={conv._id}
                      onClick={() => handleSelectStudent(student?._id)}
                      className={`w-full text-right flex items-center gap-3 px-3 py-2.5 border-b border-[#E8E2D4] transition-colors ${
                        isSelected ? 'bg-[#FBF7EE]' : 'hover:bg-[#FBF7EE]/60 active:bg-[#E8E2D4]/60'
                      }`}
                      style={{ borderRight: isSelected ? `4px solid ${HQ.MENTOR}` : '4px solid transparent' }}
                    >
                      <span
                        className="flex-none w-11 h-11 rounded-xl flex items-center justify-center text-white font-extrabold text-sm"
                        style={{ backgroundColor: getAvatarColor(`${student?.firstName}${student?.lastName}`) }}
                      >
                        {getInitials(student?.firstName, student?.lastName)}
                      </span>

                      <span className="flex-1 min-w-0">
                        <span className="flex items-center justify-between gap-2 mb-0.5">
                          <strong className={`truncate text-[15px] ${hasUnread ? 'text-[#2A2438]' : 'text-[#2A2438] font-bold'}`}>
                            {student?.firstName} {student?.lastName}
                          </strong>
                          <span className="flex-none text-[11px] text-[#756E85]">
                            {timeAgoAr(conv.lastMessageAt)}
                          </span>
                        </span>
                        <span className="flex items-center justify-between gap-2">
                          <span className={`truncate text-[13px] ${hasUnread ? 'font-bold text-[#2A2438]' : 'text-[#756E85]'}`}>
                            {conv.lastMessage || 'بدء محادثة'}
                          </span>
                          {hasUnread && (
                            <span
                              className="flex-none min-w-[20px] h-5 px-1.5 rounded-full bg-[#C2410C] text-white text-[11px] font-black flex items-center justify-center"
                            >
                              {conv.unreadByAdminCount}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 2: Chat View */}
          <div
            className={`relative flex-1 flex flex-col bg-[#FBF7EE] overflow-hidden ${
              mobileView === 'list' ? 'hidden md:flex' : 'flex'
            }`}
          >
            {selectedStudentId && currentStudent ? (
              <>
                {/* Active Student Header */}
                <div className="flex-none bg-white border-b border-[#E8E2D4] px-3 py-2 sm:px-4 sm:py-3 flex items-center gap-3">
                  {/* Mobile Back Button — RTL-correct arrow */}
                  <button
                    type="button"
                    onClick={() => setMobileView('list')}
                    className="md:hidden flex-none flex items-center justify-center w-10 h-10 rounded-xl bg-[#FBF7EE] hover:bg-white active:bg-[#E8E2D4] border border-[#E8E2D4] text-[#2A2438] transition-colors"
                    aria-label="العودة لقائمة الطلاب"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>

                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span
                      className="flex-none w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold text-sm"
                      style={{ backgroundColor: getAvatarColor(`${currentStudent.firstName}${currentStudent.lastName}`) }}
                    >
                      {getInitials(currentStudent.firstName, currentStudent.lastName)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="text-[15px] text-[#2A2438] truncate">
                          {currentStudent.firstName} {currentStudent.lastName}
                        </strong>
                        {currentStudent.assignedLevel && (
                          <span className="flex-none text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#F1EDE1] text-[#756E85]">
                            {getLevelLabel(currentStudent.assignedLevel)}
                          </span>
                        )}
                      </div>
                      <div className="hidden sm:flex items-center gap-3 mt-0.5 text-[12px] text-[#756E85]">
                        {currentStudent.phone && (
                          <span className="inline-flex items-center gap-1 truncate">
                            <Phone size={11} /> {currentStudent.phone}
                          </span>
                        )}
                        {currentStudent.email && (
                          <span className="inline-flex items-center gap-1 truncate">
                            <Mail size={11} /> {currentStudent.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Messages Body */}
                <div
                  ref={scrollRef}
                  className="hq-chat-scroll flex-1 px-3 py-3 sm:px-5 sm:py-4 overflow-y-auto flex flex-col gap-1.5 min-h-0"
                >
                  {messages.length === 0 ? (
                    <div className="text-center m-auto text-[#756E85] text-sm">
                      لا توجد رسائل سابقة مع هذا الطالب. اكتب رسالة للبدء معه.
                    </div>
                  ) : (
                    messages.map((msg, idx) => {
                      const isAdmin = msg.senderRole === 'admin' || msg.sender?.role === 'admin';
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
                            className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isAdmin ? 'self-end items-end' : 'self-start items-start'} ${showMeta ? 'mt-2' : 'mt-0.5'}`}
                          >
                            {showMeta ? (
                              <div className="flex items-center gap-1.5 mb-0.5 px-1 text-[11px]">
                                <span className={`font-bold ${isAdmin ? 'text-[#177B58]' : 'text-[#2A2438]'}`}>
                                  {isAdmin ? 'رد الإدارة (أنت)' : `${currentStudent.firstName} (الطالب)`}
                                </span>
                                <span className="text-[#756E85] text-[10px]">{timeAgoAr(msg.createdAt)}</span>
                              </div>
                            ) : null}

                            <div
                              className={`px-3.5 py-2 sm:px-4 sm:py-2.5 text-[15px] leading-relaxed rounded-2xl shadow-sm break-words whitespace-pre-wrap ${
                                isAdmin
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

                {/* Jump-to-latest (tiny corner FAB) */}
                {!atBottom && messages.length > 0 && (
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

                {/* Reply Bar */}
                <form
                  onSubmit={handleSendReply}
                  className="bg-white border-t border-[#E8E2D4] p-2.5 sm:p-3 flex items-end gap-2 flex-none"
                >
                  <AutoGrowTextarea
                    value={replyText}
                    onChange={setReplyText}
                    onSend={handleSendReply}
                    placeholder={`اكتب ردك للطالب ${currentStudent.firstName}...`}
                    disabled={isSending}
                    textareaRef={inputRef}
                    className="flex-1"
                  />

                  <button
                    type="submit"
                    disabled={!replyText.trim() || isSending}
                    aria-label="إرسال الرد"
                    className={`flex-none w-11 h-11 rounded-xl font-bold flex items-center justify-center transition-all ${
                      replyText.trim() && !isSending
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
              </>
            ) : (
              <div className="m-auto text-center px-6 py-10">
                <span
                  className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white border border-[#E8E2D4] mb-3"
                >
                  <MessageSquare size={26} className="text-[#756E85]" />
                </span>
                <p className="text-[15px] font-bold text-[#2A2438]">
                  اختر طالباً من القائمة لعرض المحادثة والرد عليه
                </p>
                <p className="hidden md:block text-[13px] text-[#756E85] mt-1">
                  يمكنك البحث بالاسم أو البريد الإلكتروني في القائمة الجانبية
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </PageLayout>
  );
}
