// ─── Auth store (Zustand) ─────────────────────────────────────────────────────
// Global state for the logged-in user, tokens, and auth actions.
//
// Why Zustand instead of useState?
//   useState lives inside ONE component. Zustand state lives outside React and
//   can be read by any component anywhere in the tree without prop drilling.
//   The header reads the user's name, the sidebar reads their role, protected
//   routes check isAuthenticated — all from this single store.
//
// Why persist middleware?
//   Without it the store resets to null on every page refresh and the user
//   would have to log in again. persist saves selected state to localStorage
//   so after a refresh the user is still considered authenticated.

import { create } from 'zustand';
import { persist } from 'zustand/middleware'; // persists state to localStorage
import api from '@/lib/api';

// ─── TypeScript types ─────────────────────────────────────────────────────────

interface User {
  id: string;
  loginId: string;
  name: string;
  email: string;
  role: string;
  requestedRole?: string | null;
  approvedRole?: string | null;
  accountStatus?: string;
}

interface AuthState {
  // State fields
  user: User | null;            // null when not logged in
  accessToken: string | null;   // short-lived JWT (15 min) — sent on every API request
  refreshToken: string | null;  // long-lived JWT (7 days) — used to get new access tokens
  isAuthenticated: boolean;     // true after a successful login
  isLoading: boolean;           // true while a login/signup/reset API call is in-flight
  error: string | null;         // last auth error message, shown in the login form

  // Actions — functions that components call to change auth state
  login: (loginId: string, password: string) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => void;
  forgotPassword: (loginIdOrEmail: string, newPassword: string) => Promise<void>;
  clearError: () => void;
  setUser: (user: User) => void;
}

interface SignupData {
  loginId: string;
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  requestedRole: string;
}

// ─── Store definition ─────────────────────────────────────────────────────────
// create<AuthState>() — builds the store with TypeScript type-checking.
// persist(...) — wraps the store so selected fields are saved to localStorage.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // ── Initial state ──────────────────────────────────────────────────────
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // ── login ──────────────────────────────────────────────────────────────
      // Calls POST /auth/login, stores the returned tokens in both localStorage
      // (for the Axios interceptor) and Zustand (for components to read).
      // set() is Zustand's state updater — it merges the new object into the store.
      login: async (loginId: string, password: string) => {
        set({ isLoading: true, error: null }); // show loading spinner, clear old errors
        try {
          const response = await api.post('/auth/login', { loginId, password });
          const { accessToken, refreshToken, user } = response.data.data;

          // Store tokens in localStorage so the Axios interceptor can read them
          // on every subsequent request (the store itself doesn't persist tokens)
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);

          // Update the store — all components reading isAuthenticated or user
          // will re-render automatically
          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          // Store the error message so the login form can display it
          set({
            error: error.response?.data?.error || 'Invalid Login Id or Password',
            isLoading: false,
          });
          throw error; // re-throw so the form's catch block can handle it too
        }
      },

      // ── signup ─────────────────────────────────────────────────────────────
      // Creates a new account. The user is NOT logged in after signup —
      // they must wait for admin approval before they can log in.
      signup: async (data: SignupData) => {
        set({ isLoading: true, error: null });
        try {
          await api.post('/auth/signup', data);
          set({ isLoading: false }); // no user/tokens — just stop the loading spinner
        } catch (error: any) {
          set({
            error: error.response?.data?.error || 'Signup failed',
            isLoading: false,
          });
          throw error;
        }
      },

      // ── logout ─────────────────────────────────────────────────────────────
      // Clears tokens from localStorage and resets all auth state to initial values.
      // The Axios interceptor will no longer find tokens so API calls will 401.
      logout: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      // ── forgotPassword ─────────────────────────────────────────────────────
      // Resets the user's password without an email link — just supply the new one.
      forgotPassword: async (loginIdOrEmail: string, newPassword: string) => {
        set({ isLoading: true, error: null });
        try {
          await api.post('/auth/forgot-password', { loginIdOrEmail, newPassword });
          set({ isLoading: false });
        } catch (error: any) {
          set({
            error: error.response?.data?.error || 'Password reset failed',
            isLoading: false,
          });
          throw error;
        }
      },

      // ── clearError ─────────────────────────────────────────────────────────
      // Called when the user starts typing in the login form to dismiss the
      // previous error message.
      clearError: () => set({ error: null }),

      // ── setUser ────────────────────────────────────────────────────────────
      // Allows the /me endpoint response to update the user profile in the store
      // (e.g. after an admin changes the user's role).
      setUser: (user: User) => set({ user }),
    }),
    {
      name: 'auth-storage', // localStorage key name
      // partialize — only persist these two fields to localStorage.
      // We deliberately exclude tokens because they're already in localStorage
      // via the login action. Persisting them here would be redundant duplication.
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
