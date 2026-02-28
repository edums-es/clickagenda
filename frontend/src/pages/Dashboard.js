import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CalendarDays,
  Users,
  DollarSign,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusLabels = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  arrived: "Chegou",
  in_progress: "Atendendo",
  completed: "Concluido",
  cancelled: "Cancelado",
  no_show: "Faltou",
};

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await api.get("/dashboard/stats");
      setStats(res.data);
    } catch (err) {
      console.error("Error loading stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const today = format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight">
            Ola, {user?.name?.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground capitalize mt-1">{today}</p>
        </div>
        {user?.slug && (
          <a
            href={`/p/${user.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="dashboard-public-link"
          >
            <Button variant="outline" size="sm" className="gap-2">
              <ExternalLink className="h-3.5 w-3.5" />
              Minha pagina
            </Button>
          </a>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-soft" data-testid="stat-today">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-heading">{stats?.total_today || 0}</p>
                <p className="text-xs text-muted-foreground">Hoje</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft" data-testid="stat-confirmed">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 text-teal-700" />
              </div>
              <div>
                <p className="text-2xl font-bold font-heading">{stats?.confirmed || 0}</p>
                <p className="text-xs text-muted-foreground">Confirmados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft" data-testid="stat-clients">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <p className="text-2xl font-bold font-heading">{stats?.total_clients || 0}</p>
                <p className="text-xs text-muted-foreground">Clientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft" data-testid="stat-revenue">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <DollarSign className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <p className="text-2xl font-bold font-heading">
                  R$ {(stats?.revenue_month || 0).toFixed(0)}
                </p>
                <p className="text-xs text-muted-foreground">Receita do mes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Agenda + Upcoming */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="shadow-soft" data-testid="today-agenda-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-heading text-lg">Agenda de hoje</CardTitle>
                <Link to="/agenda">
                  <Button variant="ghost" size="sm" className="text-xs gap-1" data-testid="go-to-calendar-btn">
                    Ver tudo <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {!stats?.today_appointments?.length ? (
                <div className="text-center py-8">
                  <CalendarDays className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum agendamento hoje</p>
                  <Link to="/agenda">
                    <Button variant="link" size="sm" className="mt-2 text-primary" data-testid="add-appointment-link">
                      Adicionar agendamento
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {stats.today_appointments.map((apt, i) => (
                    <div
                      key={apt.appointment_id}
                      className={`stagger-item flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors`}
                      data-testid={`today-apt-${i}`}
                    >
                      <div className="text-center shrink-0 w-14">
                        <p className="text-sm font-semibold">{apt.start_time}</p>
                        <p className="text-xs text-muted-foreground">{apt.end_time}</p>
                      </div>
                      <Separator orientation="vertical" className="h-10" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{apt.client_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{apt.service_name}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`status-badge status-${apt.status} text-xs shrink-0`}
                      >
                        {statusLabels[apt.status] || apt.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="shadow-soft" data-testid="upcoming-card">
            <CardHeader className="pb-3">
              <CardTitle className="font-heading text-lg">Proximos</CardTitle>
            </CardHeader>
            <CardContent>
              {!stats?.upcoming?.length ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sem agendamentos futuros
                </p>
              ) : (
                <div className="space-y-3">
                  {stats.upcoming.map((apt, i) => (
                    <div key={apt.appointment_id} className="flex items-start gap-3 stagger-item" data-testid={`upcoming-apt-${i}`}>
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{apt.client_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {apt.date} as {apt.start_time}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{apt.service_name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
