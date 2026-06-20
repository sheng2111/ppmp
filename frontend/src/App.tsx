import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/layout/Layout";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import AuthCallback from "./pages/AuthCallback";
import OnboardingPage from "./pages/OnboardingPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordpage";
import PPMPForm from "./pages/PPMPForm";

// Lazy Loaded Pages (Kept cleanly split to prevent overlapping declarations)
const PPMPList = React.lazy(() => import("./pages/PPMPList"));
const PPMPDetail = React.lazy(() => import("./pages/PPMPDetail"));

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading)
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400">
        Loading...
      </div>
    );
  if (!user) return <Navigate to="/login" />;
  return <Layout>{children}</Layout>;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route
      path="/"
      element={
        <PrivateRoute>
          <Dashboard />
        </PrivateRoute>
      }
    />
    <Route
      path="/ppmp"
      element={
        <PrivateRoute>
          <React.Suspense fallback={<div>Loading...</div>}>
            <PPMPList />
          </React.Suspense>
        </PrivateRoute>
      }
    />
    <Route
      path="/ppmp/new"
      element={
        <PrivateRoute>
          <React.Suspense fallback={<div>Loading...</div>}>
            <PPMPForm />
          </React.Suspense>
        </PrivateRoute>
      }
    />
    <Route
      path="/ppmp/:id"
      element={
        <PrivateRoute>
          <React.Suspense fallback={<div>Loading...</div>}>
            <PPMPDetail />
          </React.Suspense>
        </PrivateRoute>
      }
    />
    <Route
      path="/ppmp/:id/edit"
      element={
        <PrivateRoute>
          <React.Suspense fallback={<div>Loading...</div>}>
            <PPMPForm />
          </React.Suspense>
        </PrivateRoute>
      }
    />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="*" element={<Navigate to="/" />} />
    <Route path="/onboarding" element={<OnboardingPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
  </Routes>
);

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </AuthProvider>
);

export default App;
