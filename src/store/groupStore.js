import { create } from 'zustand';

// Compatibility store during transition from groups to 1-on-1 private lessons
const useGroupStore = create(() => ({
  groups: [],
  group: null,
  students: [],
  studyPlan: null,
  isLoading: false,
  error: null,
  fetchAllGroups: async () => ({ groups: [] }),
  fetchMyGroup: async () => null,
  fetchGroupStudents: async () => [],
  fetchStudyPlan: async () => null,
  createGroup: async () => {},
  updateGroup: async () => {},
  deleteGroup: async () => {},
}));

export default useGroupStore;
