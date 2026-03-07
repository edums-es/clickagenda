import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, Clock, MapPin, ArrowRight } from "lucide-react";

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

export default function ClientAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("upcoming");

  useEffect(() => { loadAppointments(); }, [tab]);

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const res = await api.get("/client/appointments");
      setAppointments(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const today = new Date().toISOString().split("T")[0];
  const upcoming = appointments.filter((a) => a.date >= today && !["cancelled", "no_show", "completed"].includes(a.status));
  const past = appointments.filter((a) => a.date < today || ["completed"].includes(a.status));
  const cancelled = appointments.filter((a) => ["cancelled", "no_show"].includes(a.status));

  const displayed = tab === "upcoming" ? upcoming : tab === "past" ? past : cancelled;

  return (
    <div className="space-y-6" data-testid="client-appointments-page">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight">Meus Agendamentos</h1>
        <p className="text-sm text-muted-foreground mt-1">{appointments.length} agendamentos no total</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList data-testid="appointments-tabs">
          <TabsTrigger value="upcoming" data-testid="tab-upcoming">Proximos ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past" data-testid="tab-past">Historico ({past.length})</TabsTrigger>
          <TabsTrigger value="cancelled" data-testid="tab-cancelled">Cancelados ({cancelled.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : displayed.length === 0 ? (
        <Card className="shadow-soft">
          <CardContent className="py-12 text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {tab === "upcoming" ? "Nenhum agendamento futuro" : tab === "past" ? "Nenhum historico" : "Nenhum cancelamento"}
            </p>
            {tab === "upcoming" && (
              <Link to="/marketplace">
                <Button variant="link" size="sm" className="mt-2 text-primary">Buscar profissionais</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayed.map((apt, i) => (
            <Card key={apt.appointment_id} className="shadow-soft stagger-item hover:shadow-md transition-shadow" data-testid={`client-apt-${i}`}>
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="text-center shrink-0 w-16 py-1 px-2 rounded-lg bg-primary/5">
                      <p className="text-sm font-bold">{apt.start_time}</p>
                      <p className="text-xs text-muted-foreground">{apt.date}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{apt.service_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {apt.professional?.business_name || apt.professional?.name}
                      </p>
                      {apt.service_price > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">R$ {apt.service_price?.toFixed(2)}</p>
                      )}
                      {statusHints[apt.status] && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{statusHints[apt.status]}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={`status-badge status-${apt.status} text-xs`}>
                      {statusLabels[apt.status] || apt.status}
                    </Badge>
                    {apt.token && ["scheduled", "confirmed"].includes(apt.status) && (
                      <Link to={`/agendamento/${apt.token}`}>
                        <Button variant="outline" size="sm" className="gap-1 text-xs" data-testid={`manage-client-apt-${i}`}>
                          Gerenciar <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
