import { create } from 'zustand';
import api from '../services/api';
import useAuthStore from './authStore';
import { uploadDirectToCloudinary } from '../utils/cloudinaryUpload';

/**
 * Upload each recording blob straight to Cloudinary and return the JSON
 * payload the backend expects. Throws on upload failure — no server fallback.
 */
async function uploadRecordingsToCloudinary(oralRecordings, idKey) {
  const withBlobs = (oralRecordings || []).filter((r) => r?.audioBlob);
  if (!withBlobs.length) return [];
  const recordings = [];
  for (const rec of withBlobs) {
    const up = await uploadDirectToCloudinary(rec.audioBlob, { kind: 'audio' });
    recordings.push({
      [idKey]: rec[idKey] || rec.taskId || rec.questionId || null,
      audioUrl: up.url,
      audioPublicId: up.publicId,
      audioResourceType: up.resourceType,
    });
  }
  return recordings;
}

const useExamStore = create((set, get) => ({
  currentExam: null,
  answers: {},          // MCQ answers: { [questionIndex]: optionIndex }
  writtenAnswers: {},   // Written answers: { [questionIndex]: 'text' }
  surveyAnswers: [],
  oralRecordings: [],   // [{ questionId, audioBlob, audioUrl }]
  result: null,
  results: [],          // student's past results
  groupExams: [],       // exams for a group
  availableExams: [],   // exams the student hasn't taken yet
  assignedExams: [],    // unified assigned exams for the student
  adminExams: [],       // admin: all exams across platform
  groupResults: [],     // admin: results for a group
  examResults: [],      // admin: results for a specific exam
  isLoading: false,
  isSubmitting: false,
  currentQuestion: 0,

  setCurrentExam: (exam) => set({ currentExam: exam, answers: {}, writtenAnswers: {}, currentQuestion: 0 }),

  setAnswer: (questionIndex, answer) => set((state) => ({
    answers: { ...state.answers, [questionIndex]: answer },
  })),

  setWrittenAnswer: (questionIndex, text) => set((state) => ({
    writtenAnswers: { ...state.writtenAnswers, [questionIndex]: text },
  })),

  setSurveyAnswer: (index, option) => set((state) => {
    const updated = [...state.surveyAnswers];
    updated[index] = option;
    return { surveyAnswers: updated };
  }),

  addOralRecording: (questionId, audioBlob, audioUrl) => set((state) => ({
    oralRecordings: [
      ...state.oralRecordings.filter((r) => r.questionId !== questionId),
      // taskId mirrors questionId: the oral-submit endpoint reads taskId_*,
      // the recitation endpoint reads questionId_* — both must be present.
      { questionId, taskId: questionId, audioBlob, audioUrl },
    ],
  })),

  nextQuestion: () => set((state) => ({
    currentQuestion: Math.min(state.currentQuestion + 1, (state.currentExam?.questions?.length || 1) - 1),
  })),

  prevQuestion: () => set((state) => ({
    currentQuestion: Math.max(state.currentQuestion - 1, 0),
  })),

  placementCompleted: false,
  placementResult: null,
  // Written submitted but oral still pending (backend splits the two steps)
  writtenCompleted: false,

  fetchPlacementExam: async (type) => {
    set({ isLoading: true });
    try {
      const res = await api.get(`/exams/placement/${type}`);
      if (res.data.alreadyCompleted) {
        set({
          currentExam: res.data.exam,
          placementCompleted: true,
          placementResult: res.data.result,
          writtenCompleted: true,
          isLoading: false,
        });
        return res.data.exam;
      }
      set({
        currentExam: res.data.exam,
        placementCompleted: false,
        // Keep the written result so the written page can forward to the oral step
        // instead of letting the student retake (submit would 400 as duplicate).
        placementResult: res.data.result || null,
        writtenCompleted: !!res.data.writtenCompleted,
        isLoading: false,
      });
      return res.data.exam;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  // Submit exam with MCQ + Written answers
  submitWrittenExam: async (examId) => {
    const { answers, writtenAnswers, surveyAnswers, currentExam } = get();
    set({ isSubmitting: true });
    try {
      const answersArray = (currentExam?.questions || []).map((_, idx) => answers[idx] ?? -1);
      const writtenAnswersArray = (currentExam?.questions || []).map((_, idx) => writtenAnswers[idx] ?? '');
      // فضّل النسخة المُثراة بالنصوص (يكتبها SurveyPage) — وإلا الفهارس كالسابق
      let surveyPayload = surveyAnswers;
      try {
        const { user } = useAuthStore.getState();
        const regType = user?.registrationType || 'student';
        const enriched = JSON.parse(
          localStorage.getItem(`survey_enriched_${user?._id || 'guest'}_${regType}`) || 'null'
        );
        if (Array.isArray(enriched) && enriched.some(Boolean)) {
          surveyPayload = enriched;
        }
      } catch (_) {}
      const res = await api.post(`/exams/${examId}/submit`, {
        answers: answersArray,
        writtenAnswers: writtenAnswersArray,
        surveyAnswers: surveyPayload,
        examType: currentExam?.type,
      });
      set({ result: res.data.result, isSubmitting: false });
      return res.data.result;
    } catch (error) {
      set({ isSubmitting: false });
      throw error;
    }
  },

  // Submit oral exam — Browser → Cloudinary مباشرة، لا multipart عبر السيرفر
  submitOralExam: async (examId, resultId) => {
    const { oralRecordings } = get();
    set({ isSubmitting: true });
    try {
      const recordings = await uploadRecordingsToCloudinary(oralRecordings, 'taskId');
      const payload = { recordings };
      if (resultId) payload.resultId = resultId;
      const res = await api.post(`/exams/${examId}/submit-oral`, payload);
      set({
        isSubmitting: false,
        result: res.data.result,
        placementResult: res.data.result,
        placementCompleted: true,
      });
      return res.data.result;
    } catch (error) {
      set({ isSubmitting: false });
      throw error;
    }
  },

  // Submit recitation recordings — Browser → Cloudinary مباشرة
  submitRecitationAnswers: async (examId, resultId) => {
    const { oralRecordings } = get();
    set({ isSubmitting: true });
    try {
      const recordings = await uploadRecordingsToCloudinary(oralRecordings, 'questionId');
      const payload = { recordings };
      if (resultId) payload.examResultId = resultId;
      const res = await api.post(`/exams/${examId}/submit-recitation`, payload);
      set({ isSubmitting: false });
      return res.data.result;
    } catch (error) {
      set({ isSubmitting: false });
      throw error;
    }
  },

  fetchMyResults: async (studentId) => {
    try {
      const res = await api.get(`/exams/results/student/${studentId}`);
      set({ results: res.data.results });
    } catch (_) {}
  },

  fetchGroupExams: async (groupId) => {
    try {
      const res = await api.get(`/exams/group/${groupId}`);
      set({ groupExams: res.data.exams });
      return res.data.exams;
    } catch (_) {}
  },

  // Fetch unified assigned exams for the student (individual, group, or level)
  fetchAssignedExams: async () => {
    try {
      const res = await api.get('/exams/student/assigned');
      const all = res.data.exams || [];
      const pending = all.filter(e => !e.isCompleted);
      set({ assignedExams: all, availableExams: pending, groupExams: all });
      return all;
    } catch (_) {
      return [];
    }
  },

  // Fetch exams for the student's group + filter out ones already taken (backward compatible)
  fetchAvailableExams: async (groupId, studentId) => {
    try {
      const res = await api.get('/exams/student/assigned');
      const all = res.data.exams || [];
      const pending = all.filter(e => !e.isCompleted);
      set({ availableExams: pending, assignedExams: all, groupExams: all });
      return pending;
    } catch (_) {
      try {
        const [examsRes, resultsRes] = await Promise.all([
          api.get(`/exams/group/${groupId || 'all'}`),
          api.get(`/exams/results/student/${studentId}`),
        ]);
        const allExams = examsRes.data.exams || [];
        const takenExamIds = new Set((resultsRes.data.results || []).map(r => r.exam?._id));
        const available = allExams.filter(e => !takenExamIds.has(e._id));
        set({ availableExams: available, groupExams: allExams });
        return available;
      } catch (err) {
        return [];
      }
    }
  },

  // Admin: get all exams across platform with stats
  fetchAdminAllExams: async (params = {}) => {
    set({ isLoading: true });
    try {
      const res = await api.get('/exams/admin/all', { params });
      set({ adminExams: res.data.exams || [], isLoading: false });
      return res.data.exams || [];
    } catch (error) {
      set({ isLoading: false });
      return [];
    }
  },

  // Admin: get all results for a group
  fetchGroupResults: async (groupId) => {
    try {
      const res = await api.get(`/exams/group/${groupId}/results`);
      set({ groupResults: res.data.results });
      return res.data;
    } catch (_) {}
  },

  // Admin: get results for a specific exam
  fetchExamResults: async (examId) => {
    set({ isLoading: true });
    try {
      const res = await api.get(`/exams/${examId}/results`);
      set({ examResults: res.data.results, isLoading: false });
      return res.data.results;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  fetchResult: async (resultId) => {
    const res = await api.get(`/exams/results/${resultId}`);
    set({ result: res.data.result });
    return res.data.result;
  },

  // Admin/Teacher: create exam
  createGroupExam: async (examData) => {
    const res = await api.post('/exams', examData);
    return res.data.exam;
  },

  // Admin: create standalone bank exam (hidden until assigned)
  createBankExam: async (examData) => {
    const res = await api.post('/exams', { ...examData, targetType: 'bank' });
    return res.data.exam;
  },

  // Admin: place a bank exam on a student's individual-plan lesson (or direct assign without lesson)
  assignExamToLesson: async (examId, { studentId, lessonId }) => {
    const res = await api.post(`/exams/${examId}/assign-lesson`, { studentId, lessonId: lessonId || undefined });
    return res.data.exam;
  },

  // Admin/Teacher: update exam
  updateGroupExam: async (examId, examData) => {
    const res = await api.put(`/exams/${examId}`, examData);
    return res.data.exam;
  },

  // Admin/Teacher: delete exam
  deleteGroupExam: async (examId) => {
    await api.delete(`/exams/${examId}`);
    set((state) => ({
      groupExams: state.groupExams.filter(e => e._id !== examId),
    }));
  },

  resetExam: () => set({
    currentExam: null, answers: {}, writtenAnswers: {}, surveyAnswers: [], oralRecordings: [],
    result: null, currentQuestion: 0,
  }),
}));

export default useExamStore;
