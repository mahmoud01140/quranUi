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
        className="halaqa"
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          height: 'calc(100vh - 110px)',
          display: 'flex',
          flexDirection: 'column',
          background: HQ.SURFACE,
          border: `1px solid ${HQ.LINE}`,
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        }}
      >
        {/* Top Bar */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: `1px solid ${HQ.LINE}`,
            background: HQ.SURFACE,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: HQ.MENTOR_WASH,
                border: `1px solid ${HQ.MENTOR}33`,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none',
              }}
            >
              <MessageSquare size={20} color={HQ.MENTOR} />
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: HQ.INK }}>
                  رسائل ومناقشات الطلاب
                </h1>
                {totalUnread > 0 && (
                  <HqBadge tone="danger">
                    {totalUnread} رسائل غير مقروءة
                  </HqBadge>
                )}
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: HQ.MUTED }}>
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

        {/* Main 2-Column Content */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          
          {/* Column 1: Conversations List */}
          <div
            style={{
              width: window.innerWidth < 768 && mobileView === 'chat' ? 0 : '340px',
              minWidth: window.innerWidth < 768 && mobileView === 'chat' ? 0 : '300px',
              maxWidth: '380px',
              borderLeft: `1px solid ${HQ.LINE}`,
              display: window.innerWidth < 768 && mobileView === 'chat' ? 'none' : 'flex',
              flexDirection: 'column',
              background: HQ.PAPER,
              overflow: 'hidden',
            }}
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
            style={{
              flex: 1,
              display: window.innerWidth < 768 && mobileView === 'list' ? 'none' : 'flex',
              flexDirection: 'column',
              background: HQ.SURFACE,
              overflow: 'hidden',
            }}
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
                  style={{
                    padding: '12px 16px',
                    background: HQ.SURFACE,
                    borderTop: `1px solid ${HQ.LINE}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`اكتب ردك للطالب ${currentStudent.firstName}...`}
                    disabled={isSending}
                    style={{
                      flex: 1,
                      background: HQ.PAPER,
                      border: `1px solid ${HQ.LINE}`,
                      borderRadius: 10,
                      padding: '10px 14px',
                      fontSize: 13,
                      color: HQ.INK,
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />

                  <button
                    type="submit"
                    disabled={!replyText.trim() || isSending}
                    className="hq-action"
                    style={{
                      background: replyText.trim() ? HQ.MENTOR : HQ.MUTED,
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 10,
                      padding: '0 18px',
                      height: 40,
                      fontSize: 13,
                      cursor: replyText.trim() && !isSending ? 'pointer' : 'default',
                      opacity: replyText.trim() && !isSending ? 1 : 0.6,
                    }}
                  >
                    {isSending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <>
                        <Send size={15} /> <span>إرسال الرد</span>
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
