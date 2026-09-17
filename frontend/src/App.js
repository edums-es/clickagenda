import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Pricing from "@/pages/Pricing";
import Dashboard from "@/pages/Dashboard";
import CalendarPage from "@/pages/CalendarPage";
import Clients from "@/pages/Clients";
import Services from "@/pages/Services";
import Settings from "@/pages/Settings";
import PublicProfile from "@/pages/PublicProfile";
import BookingFlow from "@/pages/BookingFlow";
import AppointmentManage from "@/pages/AppointmentManage";
import Billing from "@/pages/Billing";
import SuperAdmin from "@/pages/SuperAdmin";
import AdminIntegrations from "@/pages/AdminIntegrations";
import AdminMarketing from "@/pages/AdminMarketing";
import AdminSecurity from "@/pages/AdminSecurity";
import DashboardLayout from "@/components/DashboardLayout";

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === "superadmin" ? "/superadmin" : "/dashboard"} replace />;
  }
  return children;
}

function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/esqueci-senha" element={<ForgotPassword />} />
      <Route path="/redefinir-senha" element={<ResetPassword />} />
      <Route path="/planos" element={<Pricing />} />
      <Route path="/p/:slug" element={<PublicProfile />} />
      <Route path="/p/:slug/agendar" element={<BookingFlow />} />
      <Route path="/agendamento/:token" element={<AppointmentManage />} />
      <Route path="/billing" element={<ProtectedRoute roles={["professional"]}><DashboardLayout><Billing /></DashboardLayout></ProtectedRoute>} />
      <Route path="/superadmin" element={<ProtectedRoute roles={["superadmin"]}><DashboardLayout><SuperAdmin /></DashboardLayout></ProtectedRoute>} />
      <Route path="/superadmin/integracoes" element={<ProtectedRoute roles={["superadmin"]}><DashboardLayout><AdminIntegrations /></DashboardLayout></ProtectedRoute>} />
      <Route path="/superadmin/marketing" element={<ProtectedRoute roles={["superadmin"]}><DashboardLayout><AdminMarketing /></DashboardLayout></ProtectedRoute>} />
      <Route path="/superadmin/seguranca" element={<ProtectedRoute roles={["superadmin"]}><DashboardLayout><AdminSecurity /></DashboardLayout></ProtectedRoute>} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute roles={["professional"]}>
            <DashboardLayout><Dashboard /></DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/agenda"
        element={
          <ProtectedRoute roles={["professional"]}>
            <DashboardLayout><CalendarPage /></DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/clientes"
        element={
          <ProtectedRoute roles={["professional"]}>
            <DashboardLayout><Clients /></DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/servicos"
        element={
          <ProtectedRoute roles={["professional"]}>
            <DashboardLayout><Services /></DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/configuracoes"
        element={
          <ProtectedRoute roles={["professional"]}>
            <DashboardLayout><Settings /></DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
        <Toaster position="top-right" richColors closeButton />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
