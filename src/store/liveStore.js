import { create } from 'zustand';
import api from '../services/api';

const useLiveStore = create((set, get) => ({
  session: null,
  sessions: [],
  isLive: false,
  isBroadcasting: false,
  participants: [],
  chatMessages: [],
  raisedHands: new Set(),
  localStream: null,
  remoteStream: null,
  isLoading: false,
  isMuted: false,
  isVideoOff: false,

  setSession: (session) => set({ session }),
  setIsLive: (isLive) => set({ isLive }),
  setIsBroadcasting: (val) => set({ isBroadcasting: val }),
  setLocalStream: (stream) => set({ localStream: stream }),
  setRemoteStream: (stream) => set({ remoteStream: stream }),

  addParticipant: (participant) => set((state) => ({
    participants: [...state.participants.filter((p) => p.studentId !== participant.studentId), participant],
  })),

  removeParticipant: (id) => set((state) => ({
    participants: state.participants.filter(
      (p) => p.studentId !== id
    ),
  })),

  addChatMessage: (msg) => set((state) => ({
    chatMessages: [...state.chatMessages, { ...msg, id: Date.now() }],
  })),

  raiseHand: (studentId) => set((state) => {
    const hands = new Set(state.raisedHands);
    hands.add(studentId);
    return { raisedHands: hands };
  }),

  lowerHand: (studentId) => set((state) => {
    const hands = new Set(state.raisedHands);
    hands.delete(studentId);
    return { raisedHands: hands };
  }),

  toggleMute: () => {
    const { localStream, isMuted } = get();
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => (track.enabled = isMuted));
    }
    set({ isMuted: !isMuted });
  },

  toggleVideo: () => {
    const { localStream, isVideoOff } = get();
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => (track.enabled = isVideoOff));
    }
    set({ isVideoOff: !isVideoOff });
  },

  fetchSessions: async (groupId) => {
    set({ isLoading: true });
    try {
      const res = await api.get(`/live/group/${groupId}`);
      set({ sessions: res.data.sessions, isLoading: false });
    } catch (_) {
      set({ isLoading: false });
    }
  },

  createSession: async (data) => {
    const res = await api.post('/live', data);
    set((state) => ({ sessions: [res.data.session, ...state.sessions] }));
    return res.data.session;
  },

  startSession: async (sessionId) => {
    const res = await api.put(`/live/${sessionId}/start`);
    set({ session: res.data.session, isLive: true, isBroadcasting: true });
    return res.data.session;
  },

  endSession: async (sessionId, recordingUrl) => {
    const res = await api.put(`/live/${sessionId}/end`, { recordingUrl });
    set({ session: res.data.session, isLive: false, isBroadcasting: false });
    return res.data.session;
  },

  joinSession: async (sessionId) => {
    await api.put(`/live/${sessionId}/join`);
  },

  resetLive: () => {
    const { localStream } = get();
    // Stop all media tracks so camera/mic indicators turn off
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    set({
      session: null, isLive: false, isBroadcasting: false,
      participants: [], chatMessages: [], raisedHands: new Set(),
      localStream: null, remoteStream: null,
      isMuted: false, isVideoOff: false,
    });
  },
}));

export default useLiveStore;
