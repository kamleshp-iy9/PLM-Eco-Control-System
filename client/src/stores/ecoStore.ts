import { create } from 'zustand';
import api from '@/lib/api';

interface Eco {
  id: string;
  reference: string;
  title: string;
  description?: string | null;
  ecoType: string;
  productId: string;
  bomId: string | null;
  userId: string;
  stageId: string;
  effectiveDate: string | null;
  appliedAt?: string | null;
  versionUpdate: boolean;
  state: string;
  isStarted: boolean;
  isApplied: boolean;
  createdAt: string;
  updatedAt: string;
  product?: { id: string; name: string; status?: string; version?: number; attachments?: any[] };
  bom?: { id: string; reference: string };
  user?: { id: string; name: string; loginId: string };
  stage?: { id: string; name: string; sequence: number; isFinal: boolean; requiresApproval: boolean; allowApplyChanges?: boolean };
  _count?: { approvals: number };
  approvals?: any[];
  stageApprovalRules?: any[];
  stageApprovals?: any[];
  pendingApprovers?: any[];
  canApprove?: boolean;
  canValidate?: boolean;
  canComment?: boolean;
  canReject?: boolean;
  canApplyChanges?: boolean;
}

interface EcoStage {
  id: string;
  name: string;
  sequence: number;
  isFinal: boolean;
  requiresApproval: boolean;
  allowApplyChanges?: boolean;
}

interface EcoState {
  ecos: Eco[];
  currentEco: Eco | null;
  stages: EcoStage[];
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };

  // Actions
  fetchEcos: (params?: Record<string, any>) => Promise<void>;
  fetchEco: (id: string) => Promise<void>;
  fetchStages: () => Promise<void>;
  createEco: (data: CreateEcoData) => Promise<Eco>;
  updateEco: (id: string, data: UpdateEcoData) => Promise<void>;
  startEco: (id: string) => Promise<void>;
  approveEco: (id: string, comments?: string) => Promise<void>;
  validateEco: (id: string) => Promise<void>;
  rejectEco: (id: string, comments?: string) => Promise<void>;
  getEcoDiff: (id: string) => Promise<any>;
  clearError: () => void;
}

interface CreateEcoData {
  title: string;
  description?: string;
  ecoType: string;
  productId: string;
  bomId?: string;
  userId: string;
  effectiveDate?: string;
  versionUpdate?: boolean;
  proposedProductChanges?: any;
  proposedBomChanges?: any;
}

interface UpdateEcoData {
  title?: string;
  description?: string;
  productId?: string;
  bomId?: string;
  userId?: string;
  effectiveDate?: string;
  versionUpdate?: boolean;
  proposedProductChanges?: any;
  proposedBomChanges?: any;
}

export const useEcoStore = create<EcoState>((set, get) => ({
  ecos: [],
  currentEco: null,
  stages: [],
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  },

  fetchEcos: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/ecos', { params });
      const { ecos, pagination } = response.data.data;
      set({ ecos, pagination, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch ECOs',
        isLoading: false,
      });
    }
  },

  fetchEco: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/ecos/${id}`);
      const {
        eco,
        stages,
        stageApprovalRules,
        stageApprovals,
        pendingApprovers,
        canApprove,
        canValidate,
        canComment,
        canReject,
        canApplyChanges,
      } = response.data.data;
      set({ 
        currentEco: {
          ...eco,
          stageApprovalRules,
          stageApprovals,
          pendingApprovers,
          canApprove,
          canValidate,
          canComment,
          canReject,
          canApplyChanges,
        },
        stages: stages || get().stages,
        isLoading: false 
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch ECO',
        isLoading: false,
      });
    }
  },

  fetchStages: async () => {
    try {
      const response = await api.get('/settings/stages');
      set({ stages: response.data.data.stages });
    } catch (error: any) {
      console.error('Failed to fetch stages:', error);
    }
  },

  createEco: async (data: CreateEcoData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/ecos', data);
      const { eco } = response.data.data;
      set((state) => ({
        ecos: [eco, ...state.ecos],
        isLoading: false,
      }));
      return eco;
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to create ECO',
        isLoading: false,
      });
      throw error;
    }
  },

  updateEco: async (id: string, data: UpdateEcoData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.put(`/ecos/${id}`, data);
      const { eco } = response.data.data;
      set((state) => ({
        ecos: state.ecos.map((e) => (e.id === id ? eco : e)),
        currentEco: state.currentEco?.id === id ? eco : state.currentEco,
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to update ECO',
        isLoading: false,
      });
      throw error;
    }
  },

  startEco: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(`/ecos/${id}/start`);
      const { eco } = response.data.data;
      set((state) => ({
        ecos: state.ecos.map((e) => (e.id === id ? eco : e)),
        currentEco: state.currentEco?.id === id ? eco : state.currentEco,
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to start ECO',
        isLoading: false,
      });
      throw error;
    }
  },

  approveEco: async (id: string, comments?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(`/ecos/${id}/approve`, { comments });
      const { eco } = response.data.data;
      set((state) => ({
        ecos: state.ecos.map((e) => (e.id === id ? eco : e)),
        currentEco: state.currentEco?.id === id ? eco : state.currentEco,
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to approve ECO',
        isLoading: false,
      });
      throw error;
    }
  },

  validateEco: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(`/ecos/${id}/validate`);
      const { eco } = response.data.data;
      set((state) => ({
        ecos: state.ecos.map((e) => (e.id === id ? eco : e)),
        currentEco: state.currentEco?.id === id ? eco : state.currentEco,
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to validate ECO',
        isLoading: false,
      });
      throw error;
    }
  },

  rejectEco: async (id: string, comments?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(`/ecos/${id}/reject`, { comments });
      const { eco } = response.data.data;
      set((state) => ({
        ecos: state.ecos.map((e) => (e.id === id ? eco : e)),
        currentEco: state.currentEco?.id === id ? eco : state.currentEco,
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to reject ECO',
        isLoading: false,
      });
      throw error;
    }
  },

  getEcoDiff: async (id: string) => {
    try {
      const response = await api.get(`/ecos/${id}/diff`);
      return response.data.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get diff');
    }
  },

  clearError: () => set({ error: null }),
}));
