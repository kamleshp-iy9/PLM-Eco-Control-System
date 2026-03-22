import { create } from 'zustand';
import api from '@/lib/api';

interface EcoStage {
  id: string;
  name: string;
  sequence: number;
  isFinal: boolean;
  requiresApproval: boolean;
  allowApplyChanges: boolean;
  folded: boolean;
  description?: string | null;
  createdAt: string;
  _count?: {
    approvalRules: number;
    ecos: number;
  };
}

interface ApprovalRule {
  id: string;
  name: string;
  userId: string;
  stageId: string;
  approvalCategory: string;
  isActive: boolean;
  user?: { id: string; name: string; loginId: string; email: string; role: string };
  stage?: { id: string; name: string; sequence: number };
}

interface SettingsState {
  stages: EcoStage[];
  approvalRules: ApprovalRule[];
  isLoading: boolean;
  error: string | null;

  fetchStages: () => Promise<void>;
  createStage: (data: CreateStageData) => Promise<void>;
  updateStage: (id: string, data: Partial<CreateStageData>) => Promise<void>;
  deleteStage: (id: string) => Promise<void>;
  fetchApprovalRules: (stageId: string) => Promise<void>;
  createApprovalRule: (stageId: string, data: CreateApprovalRuleData) => Promise<void>;
  updateApprovalRule: (stageId: string, id: string, data: Partial<CreateApprovalRuleData & { isActive: boolean }>) => Promise<void>;
  deleteApprovalRule: (stageId: string, id: string) => Promise<void>;
  clearError: () => void;
}

interface CreateStageData {
  name: string;
  sequence: number;
  requiresApproval?: boolean;
  isFinal?: boolean;
  allowApplyChanges?: boolean;
  folded?: boolean;
  description?: string | null;
}

interface CreateApprovalRuleData {
  name: string;
  userId: string;
  approvalCategory: string;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  stages: [],
  approvalRules: [],
  isLoading: false,
  error: null,

  fetchStages: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/settings/stages');
      set({ stages: response.data.data.stages, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch stages',
        isLoading: false,
      });
    }
  },

  createStage: async (data: CreateStageData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/settings/stages', data);
      const { stage } = response.data.data;
      set((state) => ({
        stages: [...state.stages, stage].sort((a, b) => a.sequence - b.sequence),
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to create stage',
        isLoading: false,
      });
      throw error;
    }
  },

  updateStage: async (id: string, data: Partial<CreateStageData>) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.put(`/settings/stages/${id}`, data);
      const { stage } = response.data.data;
      set((state) => ({
        stages: state.stages.map((existingStage) => (existingStage.id === id ? stage : existingStage)).sort((a, b) => a.sequence - b.sequence),
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to update stage',
        isLoading: false,
      });
      throw error;
    }
  },

  deleteStage: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/settings/stages/${id}`);
      set((state) => ({
        stages: state.stages.filter((stage) => stage.id !== id),
        approvalRules: state.approvalRules.filter((rule) => rule.stageId !== id),
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to delete stage',
        isLoading: false,
      });
      throw error;
    }
  },

  fetchApprovalRules: async (stageId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/settings/stages/${stageId}/approvals`);
      set({ approvalRules: response.data.data.rules, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch approval rules',
        isLoading: false,
      });
    }
  },

  createApprovalRule: async (stageId: string, data: CreateApprovalRuleData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(`/settings/stages/${stageId}/approvals`, data);
      const { rule } = response.data.data;
      set((state) => ({
        approvalRules: [...state.approvalRules, rule],
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to create approval rule',
        isLoading: false,
      });
      throw error;
    }
  },

  updateApprovalRule: async (stageId: string, id: string, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.put(`/settings/stages/${stageId}/approvals/${id}`, data);
      const { rule } = response.data.data;
      set((state) => ({
        approvalRules: state.approvalRules.map((approvalRule) => (approvalRule.id === id ? rule : approvalRule)),
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to update approval rule',
        isLoading: false,
      });
      throw error;
    }
  },

  deleteApprovalRule: async (stageId: string, id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/settings/stages/${stageId}/approvals/${id}`);
      set((state) => ({
        approvalRules: state.approvalRules.filter((rule) => rule.id !== id),
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to delete approval rule',
        isLoading: false,
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
