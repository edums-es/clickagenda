import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  Search,
  CalendarDays,
  Heart,
  Settings,
  LogOut,
  Menu,
} from "lucide-react";

const navItems = [
  { to: "/cliente", icon: LayoutDashboard, label: "Meu Painel" },
  { to: "/marketplace", icon: Search, label: "Buscar Profissionais" },
  { to: "/cliente/agendamentos", icon: CalendarDays, label: "Meus Agendamentos" },
  { to: "/cliente/favoritos", icon: Heart, label: "Favoritos" },
  { to: "/cliente/config", icon: Settings, label: "Configuracoes" },
];

function ClientSidebar({ onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <aside className="flex flex-col h-full w-64 bg-card border-r border-border" data-testid="client-sidebar">
      <div className="p-6">
        <h1 className="font-heading text-xl font-bold tracking-tight text-primary">SalãoZap</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Seu slot, sua agenda.</p>
      </div>
      <Separator />
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/cliente"}
            onClick={onClose}
            data-testid={`client-nav-${item.to.split("/").pop()}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <Separator />
      <div className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.picture} alt={user?.name} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="client-logout-btn" className="h-8 w-8 text-muted-foreground hover:text-destructive">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

export default function ClientLayout({ children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden md:block fixed inset-y-0 left-0 z-30">
        <ClientSidebar />
      </div>
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 glass-nav px-4 py-3 flex items-center gap-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="client-mobile-menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <ClientSidebar onClose={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="font-heading font-bold text-primary text-lg">SalãoZap</span>
      </div>
      <main className="flex-1 md:ml-64 pt-16 md:pt-0 overflow-x-hidden">
        <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in w-full">{children}</div>
      </main>
    </div>
  );
}
