import { create } from 'zustand';
import api from '@/lib/api';

interface BomComponent {
  id: string;
  componentName: string;
  quantity: number;
  units: string;
}

interface BomOperation {
  id: string;
  operationName: string;
  expectedDuration: number;
  workCenter: string;
}

interface Bom {
  id: string;
  reference: string;
  productId: string;
  quantity: number;
  units: string;
  version: number;
  status: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  product?: { id: string; name: string };
  components?: BomComponent[];
  operations?: BomOperation[];
  parent?: { id: string; reference: string; version: number };
  _count?: { components: number; operations: number };
}

interface BomState {
  boms: Bom[];
  currentBom: Bom | null;
  versions: Bom[];
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };

  // Actions
  fetchBoms: (params?: Record<string, any>) => Promise<void>;
  fetchBom: (id: string) => Promise<void>;
  fetchBomVersions: (id: string) => Promise<void>;
  createBom: (data: CreateBomData) => Promise<Bom>;
  restoreBomVersion: (id: string, versionId: string) => Promise<any>;
  clearError: () => void;
}

interface CreateBomData {
  productId: string;
  quantity: number;
  units: string;
  components?: { componentName: string; quantity: number; units: string }[];
  operations?: { operationName: string; expectedDuration: number; workCenter: string }[];
}

export const useBomStore = create<BomState>((set) => ({
  boms: [],
  currentBom: null,
  versions: [],
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  },

  fetchBoms: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/boms', { params });
      const { boms, pagination } = response.data.data;
      set({ boms, pagination, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch BoMs',
        isLoading: false,
      });
    }
  },

  fetchBom: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/boms/${id}`);
      const { bom } = response.data.data;
      set({ currentBom: bom, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch BoM',
        isLoading: false,
      });
    }
  },

  fetchBomVersions: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/boms/${id}/versions`);
      set({ versions: response.data.data.versions, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch BoM versions',
        isLoading: false,
      });
    }
  },

  createBom: async (data: CreateBomData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/boms', data);
      const { bom } = response.data.data;
      set((state) => ({
        boms: [bom, ...state.boms],
        isLoading: false,
      }));
      return bom;
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to create BoM',
        isLoading: false,
      });
      throw error;
    }
  },

  restoreBomVersion: async (id: string, versionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(`/boms/${id}/restore`, { versionId });
      set({ isLoading: false });
      return response.data.data.eco;
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to create restore ECO',
        isLoading: false,
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
