import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarDays, Heart, Clock, Search, ArrowRight, MapPin } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusLabels = {
  scheduled: "Aguardando confirmacao",
  confirmed: "Confirmado",
  arrived: "Chegou",
  in_progress: "Atendendo",
  completed: "Concluido",
  cancelled: "Cancelado",
  no_show: "Faltou",
};

const statusHints = {
  scheduled: "Aguardando confirmacao do profissional",
  confirmed: "Confirmado pelo profissional",
  cancelled: "Agendamento cancelado",
};

export default function ClientDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await api.get("/client/dashboard");
      setData(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const today = format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-x-hidden" data-testid="client-dashboard-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight">
            Ola, {(user?.name || "").split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground capitalize mt-1">{today}</p>
        </div>
        <Link to="/marketplace">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 w-full sm:w-auto" data-testid="go-marketplace-btn">
            <Search className="h-4 w-4" /> Buscar profissionais
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-soft" data-testid="stat-appointments">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-heading">{data?.total_appointments || 0}</p>
                <p className="text-xs text-muted-foreground">Agendamentos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft" data-testid="stat-upcoming-count">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-teal-700" />
              </div>
              <div>
                <p className="text-2xl font-bold font-heading">{data?.upcoming?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Proximos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft" data-testid="stat-favorites-count">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-rose-100 flex items-center justify-center shrink-0">
                <Heart className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-bold font-heading">{data?.favorites_count || 0}</p>
                <p className="text-xs text-muted-foreground">Favoritos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming */}
      <Card className="shadow-soft" data-testid="client-upcoming-card">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="font-heading text-lg">Proximos agendamentos</CardTitle>
            <Link to="/cliente/agendamentos">
              <Button variant="ghost" size="sm" className="text-xs gap-1" data-testid="view-all-apts">
                Ver todos <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {!data?.upcoming?.length ? (
            <div className="text-center py-8">
              <CalendarDays className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum agendamento futuro</p>
              <Link to="/marketplace">
                <Button variant="link" size="sm" className="mt-2 text-primary" data-testid="find-professional-link">
                  Encontrar um profissional
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {data.upcoming.map((apt, i) => (
                <div key={apt.appointment_id} className="stagger-item flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors" data-testid={`client-upcoming-${i}`}>
                  <div className="text-center shrink-0 w-14">
                    <p className="text-sm font-semibold">{apt.start_time}</p>
                    <p className="text-xs text-muted-foreground">{apt.date}</p>
                  </div>
                  <Separator orientation="vertical" className="h-10 hidden sm:block" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{apt.service_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {apt.professional?.business_name || apt.professional?.name}
                    </p>
                    {statusHints[apt.status] && (
                      <p className="text-xs text-muted-foreground truncate">{statusHints[apt.status]}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 sm:justify-end w-full sm:w-auto">
                    <Badge variant="outline" className={`status-badge status-${apt.status} text-xs shrink-0`}>
                      {statusLabels[apt.status] || apt.status}
                    </Badge>
                    {apt.token && (
                      <Link to={`/agendamento/${apt.token}`} className="flex-1 sm:flex-none">
                        <Button variant="ghost" size="sm" className="text-xs w-full sm:w-auto" data-testid={`manage-apt-${i}`}>Gerenciar</Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent */}
      {data?.recent?.length > 0 && (
        <Card className="shadow-soft" data-testid="client-recent-card">
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-lg">Historico recente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recent.slice(0, 5).map((apt, i) => (
                <div key={apt.appointment_id} className="flex flex-col sm:flex-row sm:items-center gap-2 py-2 text-sm" data-testid={`client-recent-${i}`}>
                  <span className="text-muted-foreground sm:w-20 sm:shrink-0">{apt.date}</span>
                  <span className="flex-1 min-w-0 truncate">{apt.service_name}</span>
                  <span className="text-xs text-muted-foreground min-w-0 truncate">{apt.professional?.business_name || apt.professional?.name}</span>
                  <Badge variant="outline" className={`status-badge status-${apt.status} text-[10px] sm:shrink-0`}>
                    {statusLabels[apt.status]}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
