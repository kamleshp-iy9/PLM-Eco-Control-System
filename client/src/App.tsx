// ─── App.tsx — root router ────────────────────────────────────────────────────
// Defines every client-side route using React Router v6.
// Routes are split into:
//   • Public routes — login, signup, forgot-password (redirect to /ecos if already logged in)
//   • Protected routes — everything else, wrapped in <ProtectedRoute> which checks
//     authentication and optional role requirements before rendering the page.
//
// AppLayout wraps all protected routes so they share the sidebar + header shell.
// useEcoSocket() is called here (not per-page) so the Socket.io connection
// is established once for the whole session.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { EcoDiffPage } from '@/pages/EcoDiffPage';
import { Toaster } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { useEcoSocket } from '@/hooks/useEcoSocket';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { SignupPage } from '@/pages/SignupPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { EcoPage } from '@/pages/EcoPage';
import { EcoDetailPage } from '@/pages/EcoDetailPage';
import { EcoFormPage } from '@/pages/EcoFormPage';
import { NewProductPage } from '@/pages/NewProductPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { ProductDetailPage } from '@/pages/ProductDetailPage';
import { BomsPage } from '@/pages/BomsPage';
import { BomDetailPage } from '@/pages/BomDetailPage';
import { NewBomPage } from '@/pages/NewBomPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { AdminUsersPage } from '@/pages/AdminUsersPage';
import { ROLES } from '@/lib/constants';

function App() {
  const { isAuthenticated } = useAuthStore();

  // Start the Socket.io connection as soon as the app mounts so real-time
  // ECO updates are received throughout the entire session
  useEcoSocket();

  // A valid session requires both the Zustand auth flag AND a stored token —
  // this handles the case where Zustand state was lost after a page refresh but
  // the token is still in localStorage (auth store hydrates from localStorage)
  const hasStoredTokens =
    Boolean(localStorage.getItem('accessToken')) ||
    Boolean(localStorage.getItem('refreshToken'));
  const hasSession = isAuthenticated && hasStoredTokens;

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {/* Global toast notification container — positioned top-right */}
      <Toaster position="top-right" />

      <Routes>
        {/* ─── Public routes ─────────────────────────────────────────────── */}
        {/* Redirect already-logged-in users away from auth pages */}
        <Route
          path="/login"
          element={hasSession ? <Navigate to="/ecos" /> : <LoginPage />}
        />
        <Route
          path="/signup"
          element={hasSession ? <Navigate to="/ecos" /> : <SignupPage />}
        />
        <Route
          path="/forgot-password"
          element={hasSession ? <Navigate to="/ecos" /> : <ForgotPasswordPage />}
        />

        {/* ─── Protected routes (inside the app shell) ───────────────────── */}
        {/* AppLayout renders the sidebar + header; pages render via <Outlet /> */}
        <Route element={<AppLayout />}>
          {/* Default redirect — / always goes to the ECO list */}
          <Route path="/" element={<Navigate to="/ecos" />} />

          {/* ── ECO routes ── */}
          {/* All authenticated users can view the ECO list */}
          <Route
            path="/ecos"
            element={
              <ProtectedRoute>
                <EcoPage />
              </ProtectedRoute>
            }
          />
          {/* Creating a new ECO requires Engineering or Admin role */}
          <Route
            path="/ecos/new"
            element={
              <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.ENGINEERING_USER]}>
                <EcoFormPage />
              </ProtectedRoute>
            }
          />
          {/* Editing an existing ECO requires the same roles as creation */}
          <Route
            path="/ecos/:id/edit"
            element={
              <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.ENGINEERING_USER]}>
                <EcoFormPage />
              </ProtectedRoute>
            }
          />
          {/* Any authenticated user can view ECO details (for approval actions) */}
          <Route
            path="/ecos/:id"
            element={
              <ProtectedRoute>
                <EcoDetailPage />
              </ProtectedRoute>
            }
          />
          {/* Side-by-side diff viewer showing what changed in this ECO */}
          <Route
            path="/ecos/:id/changes"
            element={
              <ProtectedRoute>
                <EcoDiffPage />
              </ProtectedRoute>
            }
          />

          {/* ── Product (master data) routes ── */}
          <Route
            path="/master-data/products"
            element={
              <ProtectedRoute>
                <ProductsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/master-data/products/new"
            element={
              <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.ENGINEERING_USER]}>
                <NewProductPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/master-data/products/:id"
            element={
              <ProtectedRoute>
                <ProductDetailPage />
              </ProtectedRoute>
            }
          />

          {/* ── Bill of Materials routes ── */}
          <Route
            path="/master-data/boms"
            element={
              <ProtectedRoute>
                <BomsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/master-data/boms/new"
            element={
              <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.ENGINEERING_USER]}>
                <NewBomPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/master-data/boms/:id"
            element={
              <ProtectedRoute>
                <BomDetailPage />
              </ProtectedRoute>
            }
          />

          {/* ── Reports ── */}
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <ReportsPage />
              </ProtectedRoute>
            }
          />

          {/* ── Settings (Admin only) ── */}
          {/* ECO stage configuration — add/reorder/rename stages */}
          <Route
            path="/settings/stages"
            element={
              <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          {/* Approval rule configuration — assign approvers to stages */}
          <Route
            path="/settings/approvals"
            element={
              <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          {/* User management — approve/reject signups, manage roles */}
          <Route
            path="/settings/users"
            element={
              <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                <AdminUsersPage />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Catch-all — unknown paths redirect to home which redirects to /ecos */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
