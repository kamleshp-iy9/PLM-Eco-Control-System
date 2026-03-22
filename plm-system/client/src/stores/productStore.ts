import { create } from 'zustand';
import api from '@/lib/api';

interface Product {
  id: string;
  name: string;
  salesPrice: number;
  costPrice: number;
  attachments: any[];
  version: number;
  status: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  boms?: { id: string; reference: string; version: number; status: string }[];
  parent?: { id: string; name: string; version: number };
}

interface ProductState {
  products: Product[];
  currentProduct: Product | null;
  versions: Product[];
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };

  // Actions
  fetchProducts: (params?: Record<string, any>) => Promise<void>;
  fetchProduct: (id: string) => Promise<void>;
  fetchProductVersions: (id: string) => Promise<void>;
  createProduct: (data: CreateProductData) => Promise<Product>;
  restoreProductVersion: (id: string, versionId: string) => Promise<any>;
  clearError: () => void;
}

interface CreateProductData {
  name: string;
  salesPrice: number;
  costPrice: number;
  attachments?: any[];
}

export const useProductStore = create<ProductState>((set) => ({
  products: [],
  currentProduct: null,
  versions: [],
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  },

  fetchProducts: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/products', { params });
      const { products, pagination } = response.data.data;
      set({ products, pagination, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch products',
        isLoading: false,
      });
    }
  },

  fetchProduct: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/products/${id}`);
      const { product } = response.data.data;
      set({ currentProduct: product, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch product',
        isLoading: false,
      });
    }
  },

  fetchProductVersions: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/products/${id}/versions`);
      set({ versions: response.data.data.versions, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch product versions',
        isLoading: false,
      });
    }
  },

  createProduct: async (data: CreateProductData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/products', data);
      const { product } = response.data.data;
      set((state) => ({
        products: [product, ...state.products],
        isLoading: false,
      }));
      return product;
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to create product',
        isLoading: false,
      });
      throw error;
    }
  },

  restoreProductVersion: async (id: string, versionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(`/products/${id}/restore`, { versionId });
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
