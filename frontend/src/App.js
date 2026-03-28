import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Pricing from "@/pages/Pricing";
import AuthCallback from "@/pages/AuthCallback";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import CalendarPage from "@/pages/CalendarPage";
import Clients from "@/pages/Clients";
import Services from "@/pages/Services";
import Settings from "@/pages/Settings";
import Marketplace from "@/pages/Marketplace";
import QuickLinks from "@/pages/QuickLinks";
import QuickLinkPage from "@/pages/QuickLinkPage";
import TurboOffers from "@/pages/TurboOffers";
import ClientDashboard from "@/pages/ClientDashboard";
import ClientAppointments from "@/pages/ClientAppointments";
import ClientFavorites from "@/pages/ClientFavorites";
import ClientConfig from "@/pages/ClientConfig";
import PublicProfile from "@/pages/PublicProfile";
import WhatsappIA from "@/pages/WhatsappIA";
import BookingFlow from "@/pages/BookingFlow";
import AppointmentManage from "@/pages/AppointmentManage";
import ClientReview from "@/pages/ClientReview";
import DashboardLayout from "@/components/DashboardLayout";
import ClientLayout from "@/components/ClientLayout";

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
    return <Navigate to={user.role === "client" ? "/cliente" : "/dashboard"} replace />;
  }
  return children;
}

function AppRouter() {
  const location = useLocation();

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  // Detect session_id during render (NOT in useEffect) to prevent race conditions
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/planos" element={<Pricing />} />
      <Route path="/esqueci-senha" element={<ForgotPassword />} />
      <Route path="/redefinir-senha" element={<ResetPassword />} />
      <Route path="/p/:slug" element={<PublicProfile />} />
      <Route path="/p/:slug/agendar" element={<BookingFlow />} />
      <Route path="/agendamento/:token" element={<AppointmentManage />} />
      <Route path="/avaliar/:id" element={<ClientReview />} />
      <Route path="/marketplace" element={<Marketplace />} />
      <Route path="/ql/:code" element={<QuickLinkPage />} />
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
        path="/links-rapidos"
        element={
          <ProtectedRoute roles={["professional"]}>
            <DashboardLayout><QuickLinks /></DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/turbo"
        element={
          <ProtectedRoute roles={["professional"]}>
            <DashboardLayout><TurboOffers /></DashboardLayout>
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
      <Route
        path="/whatsapp"
        element={
          <ProtectedRoute roles={["professional"]}>
            <DashboardLayout><WhatsappIA /></DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/cliente"
        element={
          <ProtectedRoute roles={["client"]}>
            <ClientLayout><ClientDashboard /></ClientLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/cliente/agendamentos"
        element={
          <ProtectedRoute roles={["client"]}>
            <ClientLayout><ClientAppointments /></ClientLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/cliente/favoritos"
        element={
          <ProtectedRoute roles={["client"]}>
            <ClientLayout><ClientFavorites /></ClientLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/cliente/config"
        element={
          <ProtectedRoute roles={["client"]}>
            <ClientLayout><ClientConfig /></ClientLayout>
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
