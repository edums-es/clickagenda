import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { Menu, CalendarDays, Users, Scissors, LayoutDashboard } from "lucide-react";
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import NotificationCenter from '@/components/NotificationCenter';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function DashboardLayout({ children }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const professional = user?.role !== 'superadmin';
  const tabs = [['/dashboard', 'Início', LayoutDashboard], ['/agenda', 'Agenda', CalendarDays], ['/clientes', 'Clientes', Users], ['/servicos', 'Serviços', Scissors]];

  return (
    <div className="dashboard-shell min-h-[100dvh] bg-background flex min-w-0">
      {/* Desktop sidebar */}
      <div className="hidden md:block fixed inset-y-0 left-0 z-30">
        <Sidebar />
      </div>

      {/* Mobile header + sidebar sheet */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 glass-nav mobile-safe-top px-4 py-3 flex items-center gap-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button aria-label="Abrir menu" variant="ghost" size="icon" className="h-11 w-11 rounded-xl" data-testid="mobile-menu-button">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="mobile-safe-top mobile-safe-bottom p-0 w-[min(18rem,86vw)]">
            <Sidebar onClose={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="font-heading font-bold text-lg tracking-tight text-primary flex-1">ClickAgenda</span>
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0 md:ml-64 pt-[5rem] md:pt-0">
        <div className="dashboard-content p-4 md:p-8 max-w-7xl mx-auto animate-fade-in">
          {professional && <div className="notification-anchor fixed right-4 top-3 z-50 md:static md:flex md:justify-end md:mb-4"><NotificationCenter /></div>}
          {children}
        </div>
      </main>
      {professional && <nav aria-label="Navegação principal" className="app-bottom-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-white/95 px-2 pt-2 backdrop-blur-xl md:hidden">
        {tabs.map(([to, label, Icon]) => <NavLink key={to} to={to} className={({ isActive }) => `flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold ${isActive ? 'bg-emerald-50 text-emerald-800' : 'text-slate-500'}`}><Icon className="h-5 w-5" />{label}</NavLink>)}
        <button onClick={() => setOpen(true)} className="flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] font-semibold text-slate-500"><Menu className="h-5 w-5" />Mais</button>
      </nav>}
    </div>
  );
}
