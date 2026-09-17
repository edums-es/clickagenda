import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Scissors,
  Settings,
  LogOut,
  Zap,
  CreditCard,
  ShieldCheck,
  PlugZap,
  Megaphone,
  LockKeyhole
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/agenda", icon: CalendarDays, label: "Agendamentos" },
  { to: "/servicos", icon: Scissors, label: "Servicos" },
  { to: "/clientes", icon: Users, label: "Clientes" },
];

const adminNavItems = [
  { to: "/superadmin", icon: ShieldCheck, label: "Visão geral" },
  { to: "/superadmin/integracoes", icon: PlugZap, label: "Cobrança e APIs" },
  { to: "/superadmin/marketing", icon: Megaphone, label: "Marketing e Pixel" },
  { to: "/superadmin/seguranca", icon: LockKeyhole, label: "Segurança" },
];

export default function Sidebar({ onClose }) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const isSuperadmin = user?.role === "superadmin";
  const visibleNavItems = isSuperadmin ? adminNavItems : navItems;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <aside className="flex flex-col h-full w-64 bg-[#F8F9FA] border-r border-border/50 font-sans" data-testid="sidebar">
      <div className="p-6 flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-[#00D49D] flex items-center justify-center shrink-0">
          <Zap className="h-4 w-4 text-white fill-white" />
        </div>
        <div>
          <h1 className="font-heading text-[17px] font-bold text-foreground leading-tight">
            {isSuperadmin ? "ClickAgenda" : "SalãoZap"}
          </h1>
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{isSuperadmin ? "Controle da plataforma" : "Painel do Profissional"}</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            data-testid={`nav-${item.to.slice(1)}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] transition-all duration-200 ${
                isActive
                  ? "bg-[#00D49D]/15 text-[#00D49D] font-bold"
                  : "text-[#64748B] font-semibold hover:bg-neutral-100/50 hover:text-foreground"
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 pb-6 space-y-4">
        <div className="space-y-1">
          {!isSuperadmin && <NavLink
            to="/configuracoes"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] transition-all duration-200 ${
                isActive
                  ? "bg-[#00D49D]/15 text-[#00D49D] font-bold"
                  : "text-[#64748B] font-semibold hover:bg-neutral-100/50 hover:text-foreground"
              }`
            }
          >
            <Settings className="h-5 w-5" />
            Configuracoes
          </NavLink>}
          {!isSuperadmin && <NavLink to="/billing" onClick={onClose} className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] transition-all ${isActive ? "bg-[#00D49D]/15 text-[#00D49D] font-bold" : "text-[#64748B] font-semibold hover:bg-neutral-100/50"}`}>
            <CreditCard className="h-5 w-5" /> Assinatura
          </NavLink>}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] text-[#64748B] font-semibold hover:bg-red-50 hover:text-red-500 transition-all duration-200"
          >
            <LogOut className="h-5 w-5" />
            Sair da conta
          </button>
        </div>

        {!isSuperadmin && <div className="bg-white rounded-2xl p-4 border border-border/50 shadow-sm">
          <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-1">Seu Plano</p>
          <p className="font-bold text-sm text-foreground mb-3">{user?.plan === "pro" ? "ClickAgenda Pro" : "Freemium"}</p>
          <Button onClick={() => navigate("/billing")} variant="outline" className="w-full h-9 text-xs font-bold text-[#00D49D] bg-[#00D49D]/10 border-transparent hover:bg-[#00D49D]/20">Ver assinatura</Button>
        </div>}
      </div>
    </aside>
  );
}
