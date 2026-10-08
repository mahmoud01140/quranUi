import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, Search, Send, User, ChevronLeft,
  Loader2, RotateCcw, Clock, Phone, Mail, Award, CheckCheck,
} from 'lucide-react';
import PageLayout from '../../components/shared/PageLayout';
import useDiscussionStore from '../../store/discussionStore';
import { timeAgoAr, getInitials, getAvatarColor, getLevelLabel } from '../../utils/helpers';
import toast from 'react-hot-toast';
import '../../components/halaqa/halaqa.css';
import { HQ, HqBadge } from '../../components/halaqa/primitives';

const POLL_INTERVAL = 6000;

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
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'chat'

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load conversations list
  const loadConversations = useCallback(async () => {
    try {
      await fetchAdminConversations(searchQuery);
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
    loadConversations();

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
  }, [loadConversations, loadStudentChat, selectedStudentId, reset]);

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

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      toast.error('تعذر إرسال الرد، يرجى المحاولة ثانية');
      setReplyText(text);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadByAdminCount || 0), 0);

  return (
    <PageLayout>
      <div
        className="halaqa flex flex-col w-full max-w-6xl mx-auto h-[calc(100dvh-170px)] sm:h-[calc(100dvh-150px)] lg:h-[calc(100dvh-130px)] rounded-2xl sm:rounded-3xl overflow-hidden border border-[#E8E2D4] bg-white shadow-sm"
      >
        {/* Top Bar */}
        <div className="bg-white border-b border-[#E8E2D4] px-3.5 py-2.5 sm:px-5 sm:py-3.5 flex items-center justify-between gap-2.5 flex-none">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <span
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#E2EFE7] border border-[#177B58]/20 flex items-center justify-center flex-none text-[#177B58]"
            >
              <MessageSquare className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-[#2A2438] truncate">
                  رسائل ومناقشات الطلاب
                </h1>
                {totalUnread > 0 && (
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    {totalUnread} غير مقروء
                  </span>
                )}
              </div>
              <p className="hidden sm:block text-xs text-[#756E85] mt-0.5 truncate">
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
            className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-[#FBF7EE] hover:bg-white border border-[#E8E2D4] text-[#2A2438] text-xs sm:text-sm font-bold transition-colors flex-none"
          >
            <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">تحديث</span>
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
            <div style={{ padding: '12px', borderBottom: `1px solid ${HQ.LINE}` }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} color={HQ.MUTED} style={{ position: 'absolute', right: 12, top: 12 }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث باسم الطالب أو بريده..."
                  style={{
                    width: '100%',
                    background: HQ.SURFACE,
                    border: `1px solid ${HQ.LINE}`,
                    borderRadius: 10,
                    padding: '8px 36px 8px 12px',
                    fontSize: 13,
                    color: HQ.INK,
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {conversations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: HQ.MUTED, fontSize: 13 }}>
                  لا توجد محادثات حتى الآن
                </div>
              ) : (
                conversations.map((conv) => {
                  const student = conv.student;
                  const isSelected = selectedStudentId === student?._id;
                  const hasUnread = (conv.unreadByAdminCount || 0) > 0;

                  return (
                    <div
                      key={conv._id}
                      onClick={() => handleSelectStudent(student?._id)}
                      style={{
                        padding: '12px 14px',
                        borderBottom: `1px solid ${HQ.LINE}`,
                        background: isSelected ? HQ.SURFACE : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        borderRight: isSelected ? `4px solid ${HQ.MENTOR}` : '4px solid transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 12,
                            backgroundColor: getAvatarColor(`${student?.firstName}${student?.lastName}`),
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 13,
                            fontWeight: 800,
                            flex: 'none',
                          }}
                        >
                          {getInitials(student?.firstName, student?.lastName)}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 2 }}>
                            <strong style={{ fontSize: 14, color: HQ.INK }} className="truncate">
                              {student?.firstName} {student?.lastName}
                            </strong>
                            <span style={{ fontSize: 11, color: HQ.MUTED, flex: 'none' }}>
                              {timeAgoAr(conv.lastMessageAt)}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <p style={{ margin: 0, fontSize: 12, color: hasUnread ? HQ.INK : HQ.MUTED, fontWeight: hasUnread ? 700 : 400 }} className="truncate">
                              {conv.lastMessage || 'بدء محادثة'}
                            </p>
                            {hasUnread && (
                              <span
                                style={{
                                  background: '#D9534F',
                                  color: '#fff',
                                  borderRadius: 999,
                                  padding: '1px 7px',
                                  fontSize: 11,
                                  fontWeight: 800,
                                  flex: 'none',
                                }}
                              >
                                {conv.unreadByAdminCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 2: Chat View */}
          <div
            className={`flex-1 flex flex-col bg-[#FBF7EE] overflow-hidden ${
              mobileView === 'list' ? 'hidden md:flex' : 'flex'
            }`}
          >
            {selectedStudentId && currentStudent ? (
              <>
                {/* Active Student Header */}
                <div
                  style={{
                    padding: '12px 18px',
                    borderBottom: `1px solid ${HQ.LINE}`,
                    background: HQ.SURFACE,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Mobile Back Button */}
                    <button
                      type="button"
                      onClick={() => setMobileView('list')}
                      className="md:hidden hq-action"
                      style={{ background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, padding: '0 8px', height: 32 }}
                    >
                      <ChevronLeft size={16} /> قائمة الطلاب
                    </button>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong style={{ fontSize: 15, color: HQ.INK }}>
                          {currentStudent.firstName} {currentStudent.lastName}
                        </strong>
                        {currentStudent.assignedLevel && (
                          <HqBadge tone="neutral">
                            {getLevelLabel(currentStudent.assignedLevel)}
                          </HqBadge>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 2, fontSize: 12, color: HQ.MUTED }}>
                        {currentStudent.phone && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Phone size={11} /> {currentStudent.phone}
                          </span>
                        )}
                        {currentStudent.email && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Mail size={11} /> {currentStudent.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Messages Body */}
                <div
                  style={{
                    flex: 1,
                    background: HQ.PAPER,
                    padding: '18px 20px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', margin: 'auto', color: HQ.MUTED, fontSize: 13 }}>
                      لا توجد رسائل سابقة مع هذا الطالب. اكتب رسالة للبدء معه.
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isAdmin = msg.senderRole === 'admin' || msg.sender?.role === 'admin';
                      return (
                        <div
                          key={msg._id || Math.random()}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: isAdmin ? 'flex-end' : 'flex-start',
                            maxWidth: '78%',
                            alignSelf: isAdmin ? 'flex-end' : 'flex-start',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, padding: '0 4px' }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: isAdmin ? HQ.MENTOR : HQ.INK }}>
                              {isAdmin ? 'رد الإدارة (أنت)' : `${currentStudent.firstName} (الطالب)`}
                            </span>
                            <span style={{ fontSize: 10, color: HQ.MUTED }}>
                              {timeAgoAr(msg.createdAt)}
                            </span>
                          </div>

                          <div
                            style={{
                              background: isAdmin ? HQ.MENTOR : HQ.SURFACE,
                              color: isAdmin ? '#FFFFFF' : HQ.INK,
                              border: isAdmin ? 'none' : `1px solid ${HQ.LINE}`,
                              borderRadius: isAdmin ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                              padding: '10px 14px',
                              fontSize: 14,
                              lineHeight: 1.6,
                              wordBreak: 'break-word',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
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

                {/* Reply Bar */}
                <form
                  onSubmit={handleSendReply}
                  className="bg-white border-t border-[#E8E2D4] p-2.5 sm:p-3.5 flex items-center gap-2 flex-none"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`اكتب ردك للطالب ${currentStudent.firstName}...`}
                    disabled={isSending}
                    className="flex-1 bg-[#FBF7EE] border border-[#E8E2D4] focus:border-[#177B58] focus:bg-white rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm text-[#2A2438] outline-none transition-all placeholder:text-[#756E85]"
                  />

                  <button
                    type="submit"
                    disabled={!replyText.trim() || isSending}
                    className={`flex-none h-10 px-3.5 sm:px-5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all text-white ${
                      replyText.trim() && !isSending
                        ? 'bg-[#177B58] hover:bg-[#0F5940] shadow-sm cursor-pointer'
                        : 'bg-gray-300 opacity-60 cursor-default'
                    }`}
                  >
                    {isSending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span className="hidden sm:inline">إرسال الرد</span>
                      </>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div style={{ margin: 'auto', textAlign: 'center', color: HQ.MUTED, padding: 32 }}>
                <span
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 18,
                    background: HQ.PAPER,
                    border: `1px solid ${HQ.LINE}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                  }}
                >
                  <MessageSquare size={26} color={HQ.MUTED} />
                </span>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: HQ.INK }}>
                  اختر طالباً من القائمة لعرض المحادثة والرد عليه
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </PageLayout>
  );
}
