import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Scissors,
  Settings,
  LogOut,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Painel" },
  { to: "/agenda", icon: CalendarDays, label: "Agenda" },
  { to: "/clientes", icon: Users, label: "Clientes" },
  { to: "/servicos", icon: Scissors, label: "Servicos" },
  { to: "/configuracoes", icon: Settings, label: "Configuracoes" },
];

export default function Sidebar({ onClose }) {
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
    <aside className="flex flex-col h-full w-64 bg-card border-r border-border" data-testid="sidebar">
      <div className="p-6">
        <h1 className="font-heading text-xl font-bold tracking-tight text-primary">
          Click Agenda
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Clicou, agendou.</p>
      </div>

      <Separator />

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            data-testid={`nav-${item.to.slice(1)}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3">
        {user?.slug && (
          <a
            href={`/p/${user.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="public-page-link"
            className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-accent"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Minha pagina publica
          </a>
        )}
      </div>

      <Separator />

      <div className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.picture} alt={user?.name} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            data-testid="logout-button"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
