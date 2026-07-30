import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Always-needed auth/profile pages — tiny, load eagerly
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import Profiles from './pages/Profiles';
import Home from './pages/Home';

// Route-level lazy loading for heavy pages
const MovieDetails   = lazy(() => import('./pages/MovieDetails'));
const AdminUpload    = lazy(() => import('./pages/AdminUpload'));
const AdminUsers     = lazy(() => import('./pages/AdminUsers'));
const Subscription   = lazy(() => import('./pages/Subscription'));
const WatchHistory   = lazy(() => import('./pages/WatchHistory'));
const SearchResults  = lazy(() => import('./pages/SearchResults'));
const Browse         = lazy(() => import('./pages/Browse'));
const MyList         = lazy(() => import('./pages/MyList'));
const Settings       = lazy(() => import('./pages/Settings'));

import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import { ModalProvider } from './components/ModalProvider';
import { ToastProvider } from './components/Toast';

import { useLocation } from 'react-router-dom';

const ScrollToTop: React.FC = () => {
  const { pathname, search } = useLocation();
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);
  return null;
};

// Minimal fallback — no layout shift, no spinner for sub-200ms loads
const PageFallback: React.FC = () => (
  <div className="min-h-screen bg-[#080e1c]" aria-hidden="true" />
);

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <ToastProvider>
      <ModalProvider>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />

            {/* Protected Routes */}
            <Route
              path="/profiles"
              element={
                <ProtectedRoute>
                  <Profiles />
                </ProtectedRoute>
              }
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="/browse"
              element={
                <ProtectedRoute>
                  <Browse />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-list"
              element={
                <ProtectedRoute>
                  <MyList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/search"
              element={
                <ProtectedRoute>
                  <SearchResults />
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <WatchHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/subscription"
              element={
                <ProtectedRoute>
                  <Subscription />
                </ProtectedRoute>
              }
            />
            <Route
              path="/movies/:id"
              element={
                <ProtectedRoute>
                  <MovieDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <AdminRoute>
                  <AdminUsers />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/upload"
              element={
                <AdminRoute>
                  <AdminUpload />
                </AdminRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminUpload />
                </AdminRoute>
              }
            />

            {/* Default route redirecting to home dashboard */}
            <Route
              path="*"
              element={<Navigate to="/" replace />}
            />
          </Routes>
        </Suspense>
      </ModalProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;
