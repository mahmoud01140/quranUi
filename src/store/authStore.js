import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';
// Realtime is HTTP polling (Vercel-safe) — no socket.io connection needed.

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      isCheckingAuth: true,

      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),

      register: async (data) => {
        set({ isLoading: true });
        try {
          const res = await api.post('/auth/register', data);
          set({ user: res.data.user, token: res.data.token, isLoading: false });
          return res.data;
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // identifier: رقم الهاتف أو البريد الإلكتروني (يُرسل كليهما للتوافق مع السيرفر)
      login: async (identifier, password) => {
        set({ isLoading: true });
        try {
          const res = await api.post('/auth/login', { identifier, email: identifier, password });
          set({ user: res.data.user, token: res.data.token, isLoading: false });
          return res.data;
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch (_) {}
        set({ user: null, token: null });
      },

      checkAuth: async () => {
        set({ isCheckingAuth: true });
        try {
          const token = get().token;
          if (!token) return set({ user: null, isCheckingAuth: false });
          const res = await api.get('/auth/me');
          set({ user: res.data.user, token, isCheckingAuth: false });
          return res.data.user;
        } catch (_) {
          set({ user: null, token: null, isCheckingAuth: false });
          return null;
        }
      },

      // Re-fetch the user and return the FRESH value (avoids stale-closure redirects)
      refreshUser: async () => {
        try {
          const res = await api.get('/auth/me');
          set({ user: res.data.user });
          return res.data.user;
        } catch (_) {
          return get().user;
        }
      },

      updateUser: (updates) => set((state) => ({ user: { ...state.user, ...updates } })),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token }),
    }
  )
);

export default useAuthStore;
