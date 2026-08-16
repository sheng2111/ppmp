import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LogIn/LoginPage";
import ForgotPasswordPage from "./pages/LogIn/ForgotPasswordPage";
import PendingApprovalPage from "./pages/LogIn/OnBoardingPage";
import DashboardPage from "./pages/DashboardPage";
import NotFoundPage from "./pages/NotfoundPage";
import OfficesPage from "./pages/admin/OfficesPage";
import ItemPage from "./pages/admin/ItemPage";
import PPMPListPage from "./pages/PPMP/PPMPListPage";
import CreatePPMPPage from "./pages/PPMP/CreatePPMPPage";
import PPMPDetailPage from "./pages/PPMP/PPMPDetailPage";
import EditPPMPPage from "./pages/PPMP/EditPPMPPage";
import APPPage from "./pages/APPPage";
import PRListPage from "./pages/PRs/PRListPage";
import CreatePRPage from "./pages/PRs/CreatePRPage";
import PRDetailPage from "./pages/PRs/PRDetailPage";
import MyPrdItemsPage from "./pages/PRs/MyPrdItemsPage";
import Layout from "./components/layout/Layout";
import ArchivedPage from "./pages/ArchivedPage";
import ProfilePage from "./pages/ProfilePage";
import EditPRPage from "./pages/PRs/EditPRPage";
import ResetPasswordPage from "./pages/LogIn/ResetPasswordPage";
import AdminConsolidatedPPMPPage from "./pages/PPMP/AdminConsolidatedPPMPPage";
import AdminConsolidatedAPPPage from "./pages/PPMP/AdminConsolidatedAPPPage";
import ItemizedListReportPage from "./pages/ItemizedListReportPage";
import SignatorySettingsPage from "./pages/admin/SignatorySettingsPage";
import EditAppMetaPage from "./pages/EditAppMetaPage";
import OfficesPPMPListPage from "./pages/admin/OfficesPPMPListPage";
import OfficesItemizedListReportPage from "./pages/admin/OfficesItemizedListReportPage";
import LotPriorityPage from "./pages/admin/ProcurementOrderPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
const Loading = () => (
  <div className="min-h-screen bg-blue-50 flex items-center justify-center">
    <p className="text-blue-800 text-sm">Loading...</p>
  </div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, dbUser, loading } = useAuth();

  if (loading) return <Loading />;

  // Not signed in at all
  if (!user) return <Navigate to="/login" replace />;

  // Signed in, but no User row yet — they haven't completed onboarding
  if (!dbUser) return <Navigate to="/onboarding" replace />;

  // Signed in and onboarded, but not approved yet — show pending screen, nothing else
  if (!dbUser.is_approved) return <PendingApprovalPage />;

  return <>{children}</>;
}

function OnboardingRoute() {
  const { user, dbUser, loading } = useAuth();

  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (dbUser) return <Navigate to="/dashboard" replace />;

  return <PendingApprovalPage />;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, dbUser, loading } = useAuth();

  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!dbUser) return <Navigate to="/onboarding" replace />;

  // role is the source of truth ("admin"); is_admin is legacy and unset.
  if (!dbUser.role || dbUser.role !== "admin") return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

function RequireAdminRole({ children }: { children: React.ReactNode }) {
  const { user, dbUser, loading } = useAuth();

  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!dbUser) return <Navigate to="/onboarding" replace />;

  // role is the source of truth ("admin"); is_admin is legacy and unset.
  if (dbUser.role !== "admin") return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

function DashboardGate({ children }: { children: React.ReactNode }) {
  const { dbUser, loading } = useAuth();

  if (loading) return <Loading />;
  // Admins get the dedicated admin dashboard; end users keep this one.
  if (dbUser?.role === "admin") return <Navigate to="/admin/dashboard" replace />;

  return <>{children}</>;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <Loading />;

  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public routes ── */}
        <Route
          path="/login"
          element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/onboarding" element={<OnboardingRoute />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* ── Protected routes ── */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardGate><DashboardPage /></DashboardGate>} />
          <Route
            path="/admin/dashboard"
            element={
              <RequireAdminRole>
                <AdminDashboardPage />
              </RequireAdminRole>
            }
          />
          <Route path="/ppmps" element={<PPMPListPage />} />
          <Route path="/ppmps/create" element={<CreatePPMPPage />} />
          <Route path="/ppmps/:id" element={<PPMPDetailPage />} />
          <Route path="/ppmps/:ppmpId/edit" element={<EditPPMPPage />} />
          <Route path="/archived" element={<ArchivedPage />} />
          <Route path="/admin/offices" element={<OfficesPage />} />
          <Route path="/admin/items" element={<ItemPage />} />
          <Route path="/app" element={<APPPage />} />
          <Route path="/prs" element={<PRListPage />} />
          <Route path="/prs/create" element={<CreatePRPage />} />
          <Route path="/my-prd-items" element={<MyPrdItemsPage />} />
          <Route path="/admin/lot-priority" element={<LotPriorityPage />} />
          <Route path="/prs/:id" element={<PRDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/prs/:id/edit" element={<EditPRPage />} />
          <Route path="/app/settings/:ppmpId" element={<EditAppMetaPage />} />
          <Route path="/admin/offices-ppmp" element={<OfficesPPMPListPage />} />
          <Route
            path="/admin/offices-itemized-list"
            element={<OfficesItemizedListReportPage />}
          />
          <Route
            path="/admin/signatories"
            element={<SignatorySettingsPage />}
          />
          <Route
            path="/reports/itemized-list"
            element={<ItemizedListReportPage />}
          />
          <Route
            path="/admin/ppmp-consolidation"
            element={<AdminConsolidatedPPMPPage />}
          />
          <Route
            path="/admin/app-consolidation"
            element={<AdminConsolidatedAPPPage />}
          />
        </Route>
        <Route
          path="/admin/lot-priority"
          element={
            <RequireAdmin>
              <LotPriorityPage />
            </RequireAdmin>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
