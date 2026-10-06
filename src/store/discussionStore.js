import { create } from 'zustand';
import api from '../services/api';

// Direct Student-Admin Discussion Store (Pure HTTP polling, 100% Vercel-Safe, Zero Sockets)
const useDiscussionStore = create((set, get) => ({
  thread: null,
  messages: [],
  conversations: [],
  currentStudent: null,
  isLoading: false,
  isSending: false,

  // ─── Student: Load My Conversation Thread with Admin ─────────
  fetchMyThread: async ({ silent = false } = {}) => {
    if (!silent) set({ isLoading: true });
    try {
      const res = await api.get('/discussions/my-thread');
      set({
        thread: res.data.thread,
        messages: res.data.messages || [],
        isLoading: false,
      });
      return res.data;
    } catch (error) {
      if (!silent) set({ isLoading: false });
      throw error;
    }
  },

  // ─── Student: Send Message to Admin ──────────────────────────
  sendStudentMessage: async (content) => {
    set({ isSending: true });
    try {
      const res = await api.post('/discussions/my-thread', { content });
      const newMsg = res.data.data;
      set((state) => {
        if (state.messages.some(m => m._id === newMsg._id)) return state;
        return { messages: [...state.messages, newMsg] };
      });
      return newMsg;
    } finally {
      set({ isSending: false });
    }
  },

  // ─── Admin: List All Student Conversations ───────────────────
  fetchAdminConversations: async (q = '') => {
    set({ isLoading: true });
    try {
      const res = await api.get('/discussions/admin/conversations', { params: { q } });
      set({
        conversations: res.data.conversations || [],
        isLoading: false,
      });
      return res.data.conversations;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  // ─── Admin: Load Conversation with Specific Student ──────────
  fetchAdminStudentThread: async (studentId, { silent = false } = {}) => {
    if (!silent) set({ isLoading: true });
    try {
      const res = await api.get(`/discussions/admin/conversations/${studentId}`);
      set({
        currentStudent: res.data.student,
        thread: res.data.thread,
        messages: res.data.messages || [],
        isLoading: false,
      });
      return res.data;
    } catch (error) {
      if (!silent) set({ isLoading: false });
      throw error;
    }
  },

  // ─── Admin: Send Reply to Student ────────────────────────────
  sendAdminReply: async (studentId, content) => {
    set({ isSending: true });
    try {
      const res = await api.post(`/discussions/admin/conversations/${studentId}`, { content });
      const newMsg = res.data.data;
      set((state) => {
        if (state.messages.some(m => m._id === newMsg._id)) return state;
        return { messages: [...state.messages, newMsg] };
      });
      return newMsg;
    } finally {
      set({ isSending: false });
    }
  },

  // ─── Legacy compatibility fallbacks ──────────────────────────
  fetchLessonDiscussion: async (lessonId, opts) => {
    return get().fetchMyThread(opts);
  },
  sendLessonMessage: async (lessonId, content) => {
    return get().sendStudentMessage(content);
  },

  reset: () => set({
    thread: null,
    messages: [],
    conversations: [],
    currentStudent: null,
    isLoading: false,
    isSending: false,
  }),
}));

export default useDiscussionStore;
