import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import PendingApprovalPage from "./pages/PendingApprovalPage";
import DashboardPage from "./pages/DashboardPage";
import NotFoundPage from "./pages/NotfoundPage";
import OfficesPage from "./pages/admin/OfficesPage";
import ItemPage from "./pages/admin/ItemPage";
import PPMPListPage from "./pages/PPMPListPage";
import CreatePPMPPage from "./pages/CreatePPMPPage";
import PPMPDetailPage from "./pages/PPMPDetailPage";
import EditPPMPPage from "./pages/EditPPMPPage";
import APPPage from "./pages/APPPage";
import PRListPage from "./pages/PRListPage";
import CreatePRPage from "./pages/CreatePRPage";
import PRDetailPage from "./pages/PRDetailPage";
import Layout from "./components/layout/layout";

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

  // Signed in but backend user not yet synced
  if (!dbUser) return <Loading />;

  // Signed in but not approved yet — show pending screen, nothing else
  if (!dbUser.is_approved) return <PendingApprovalPage />;

  return <>{children}</>;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <Loading />;

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/ppmps" element={<PPMPListPage />} />
          <Route path="/ppmps/create" element={<CreatePPMPPage />} />
          <Route path="/ppmps/:id" element={<PPMPDetailPage />} />
          <Route path="/ppmps/:id/edit" element={<EditPPMPPage />} />
          <Route path="/admin/offices" element={<OfficesPage />} />
          <Route path="/admin/items" element={<ItemPage />} />
          <Route path="/app" element={<APPPage />} />
          <Route path="/prs" element={<PRListPage />} />
          <Route path="/prs/create" element={<CreatePRPage />} />
          <Route path="/prs/:id" element={<PRDetailPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
