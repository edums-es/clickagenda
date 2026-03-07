import { useState, useEffect, useCallback, useRef } from "react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  Bell,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

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
  const [filterOpen, setFilterOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [newAppointments, setNewAppointments] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const todayDate = new Date();
  const monthStartDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  const initialStart = format(monthStartDate, "yyyy-MM-dd");
  const initialEnd = format(todayDate, "yyyy-MM-dd");
  const [appliedRange, setAppliedRange] = useState({ start: initialStart, end: initialEnd });
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const lastTotalRef = useRef(null);
  const audioContextRef = useRef(null);
  const soundPromptedRef = useRef(false);

  const unlockSound = useCallback(async () => {
    try {
      const ctx = audioContextRef.current || new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = ctx;
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      setSoundEnabled(true);
      return true;
    } catch {}
    return false;
  }, []);

  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const audioContext = audioContextRef.current || new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      if (audioContext.state === "suspended") return;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gainNode.gain.value = 0.06;
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.25);
    } catch {}
  }, [soundEnabled]);

  const loadStats = useCallback(async (start, end, options = {}) => {
    const { silent = false } = options;
    if (!silent) setLoading(true);
    try {
      const res = await api.get("/dashboard/stats", {
        params: { start_date: start, end_date: end },
      });
      setStats(res.data);
      setLastUpdated(new Date());
      return res.data;
    } catch (err) {
      console.error("Error loading stats:", err);
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats(appliedRange.start, appliedRange.end);
  }, [appliedRange, loadStats]);

  useEffect(() => {
    if (stats && lastTotalRef.current === null) {
      lastTotalRef.current = stats.total_today || 0;
    }
  }, [stats]);

  useEffect(() => {
    if (!user) return undefined;
    const interval = setInterval(async () => {
      const data = await loadStats(appliedRange.start, appliedRange.end, { silent: true });
      if (!data) return;
      const totalToday = data.total_today || 0;
      if (lastTotalRef.current !== null && totalToday > lastTotalRef.current) {
        const diff = totalToday - lastTotalRef.current;
        setNewAppointments((prev) => prev + diff);
        toast.success("Novo agendamento recebido");
        if (soundEnabled) {
          playNotificationSound();
        } else if (!soundPromptedRef.current) {
          toast("Ative o som para alertas");
          soundPromptedRef.current = true;
        }
      }
      lastTotalRef.current = totalToday;
    }, 20000);
    return () => clearInterval(interval);
  }, [appliedRange, loadStats, playNotificationSound, soundEnabled, user]);

  useEffect(() => {
    const handler = () => {
      unlockSound();
    };
    window.addEventListener("click", handler, { once: true });
    window.addEventListener("keydown", handler, { once: true });
    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("keydown", handler);
    };
  }, [unlockSound]);

  const today = format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR });
  const confirmationRate = Math.round((stats?.confirmation_rate || 0) * 100);
  const noShowRate = Math.round((stats?.no_show_rate || 0) * 100);
  const applyRange = (start, end) => {
    setStartDate(start);
    setEndDate(end);
    setAppliedRange({ start, end });
    setFilterOpen(false);
    lastTotalRef.current = null;
    setNewAppointments(0);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 shadow-soft border border-primary/10 bg-gradient-to-br from-primary/10 via-background to-background">
          <CardContent className="pt-6 pb-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-primary/70 font-semibold">Painel profissional</p>
                <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight mt-1">
                  Ola, {user?.name?.split(" ")[0]}
                </h1>
                <p className="text-sm text-muted-foreground capitalize mt-1">{today}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-3">
                  <span data-testid="dashboard-period-label">Periodo: {appliedRange.start} ate {appliedRange.end}</span>
                  {lastUpdated && (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Atualizado agora
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  variant={soundEnabled ? "default" : "outline"}
                  size="sm"
                  className="gap-2"
                  onClick={async () => {
                    if (soundEnabled) {
                      setSoundEnabled(false);
                      return;
                    }
                    const ok = await unlockSound();
                    if (ok) playNotificationSound();
                  }}
                  data-testid="dashboard-toggle-sound"
                >
                  <Bell className="h-3.5 w-3.5" />
                  {soundEnabled ? "Som ativo" : "Ativar som"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  setStartDate(appliedRange.start);
                  setEndDate(appliedRange.end);
                  setFilterOpen(true);
                }} data-testid="dashboard-open-filter">
                  Filtrar
                </Button>
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
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-background/60 px-3 py-1.5 text-xs">
                <span className="text-muted-foreground">Novos hoje</span>
                <span className="font-semibold text-primary">{stats?.total_today || 0}</span>
                {newAppointments > 0 && (
                  <Badge className="ml-1 bg-primary text-primary-foreground animate-pulse">+{newAppointments}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs">
                <span className="text-muted-foreground">Confirmacao</span>
                <span className="font-semibold">{confirmationRate}%</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs">
                <span className="text-muted-foreground">Receita</span>
                <span className="font-semibold">R$ {(stats?.revenue_period || 0).toFixed(0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-lg">Acoes rapidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to="/agenda" onClick={() => setNewAppointments(0)}>
              <Button className="w-full justify-between">
                Agenda de hoje
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/clientes">
              <Button variant="outline" className="w-full justify-between">
                Gerenciar clientes
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/servicos">
              <Button variant="outline" className="w-full justify-between">
                Ajustar servicos
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/configuracoes">
              <Button variant="outline" className="w-full justify-between">
                Configuracoes
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Filtrar metricas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Data inicial</p>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} data-testid="dashboard-start-date" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Data final</p>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} data-testid="dashboard-end-date" />
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - 6);
                applyRange(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
              }} data-testid="dashboard-filter-7d">
                Ultimos 7 dias
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - 29);
                applyRange(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
              }} data-testid="dashboard-filter-30d">
                Ultimos 30 dias
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                const end = new Date();
                const start = new Date(end.getFullYear(), end.getMonth(), 1);
                applyRange(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
              }} data-testid="dashboard-filter-month">
                Este mes
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setStartDate(appliedRange.start);
              setEndDate(appliedRange.end);
              setFilterOpen(false);
            }} data-testid="dashboard-filter-cancel">
              Cancelar
            </Button>
            <Button onClick={() => applyRange(startDate, endDate)} data-testid="dashboard-apply-filter">
              Aplicar filtro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className={`shadow-soft ${newAppointments > 0 ? "ring-2 ring-primary/30" : ""}`} data-testid="stat-today">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold font-heading">{stats?.total_today || 0}</p>
                  {newAppointments > 0 && (
                    <Badge className="bg-primary text-primary-foreground text-[10px]">+{newAppointments}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Hoje</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft" data-testid="stat-confirmation-rate">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 text-teal-700" />
              </div>
              <div>
                <p className="text-2xl font-bold font-heading">{confirmationRate}%</p>
                <p className="text-xs text-muted-foreground">Taxa de confirmacao</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft" data-testid="stat-no-show-rate">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <p className="text-2xl font-bold font-heading">{noShowRate}%</p>
                <p className="text-xs text-muted-foreground">Taxa de no-show</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft" data-testid="stat-revenue-period">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <DollarSign className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <p className="text-2xl font-bold font-heading">
                  R$ {(stats?.revenue_period || 0).toFixed(0)}
                </p>
                <p className="text-xs text-muted-foreground">Receita no periodo</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft" data-testid="stat-ticket-avg">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                <TrendingUp className="h-5 w-5 text-indigo-700" />
              </div>
              <div>
                <p className="text-2xl font-bold font-heading">
                  R$ {(stats?.ticket_avg || 0).toFixed(0)}
                </p>
                <p className="text-xs text-muted-foreground">Ticket medio</p>
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
      </div>

      {/* Today's Agenda + Upcoming */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="shadow-soft" data-testid="today-agenda-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-heading text-lg">Agenda de hoje</CardTitle>
                <Link to="/agenda" onClick={() => setNewAppointments(0)}>
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
