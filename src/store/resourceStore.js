import { create } from 'zustand';
import api from '../services/api';

const useResourceStore = create((set) => ({
  resources: [],
  isLoading: false,

  fetchGroupResources: async (groupId, params = {}) => {
    set({ isLoading: true });
    try {
      const res = await api.get(`/resources/group/${groupId}`, { params });
      set({ resources: res.data.resources, isLoading: false });
    } catch { set({ isLoading: false }); }
  },

  fetchGeneralResources: async (params = {}) => {
    set({ isLoading: true });
    try {
      const res = await api.get('/resources/general', { params });
      set({ resources: res.data.resources || [], isLoading: false });
      return res.data.resources || [];
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  // Direct-uploaded file metadata (URL verified server-side by cloud_name).
  uploadResourceFromUrl: async (payload) => {
    const res = await api.post('/resources', payload);
    set((state) => ({ resources: [res.data.resource, ...state.resources] }));
    return res.data.resource;
  },

  trackDownload: async (id) => {
    await api.put(`/resources/${id}/download`);
  },

  deleteResource: async (id) => {
    await api.delete(`/resources/${id}`);
    set((state) => ({ resources: state.resources.filter(r => r._id !== id) }));
  },
}));

export default useResourceStore;
