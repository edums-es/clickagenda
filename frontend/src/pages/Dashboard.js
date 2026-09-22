import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  CalendarDays,
  Users,
  DollarSign,
  CheckCircle2,
  Clock,
  ArrowRight,
  Search,
  Share2,
  Plus,
  Link as LinkIcon,
  Copy
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const statusLabels = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  arrived: "Chegou",
  in_progress: "Atendendo",
  completed: "Concluido",
  cancelled: "Cancelado",
  no_show: "Faltou",
};

import OnboardingWizard from "@/components/OnboardingWizard";
import { displayDate } from '@/lib/booking';

export default function Dashboard() {
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  useEffect(() => {
    if (user?.onboarding_completed === false) {
      setShowOnboarding(true);
    }
  }, [user]);
  
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const todayDate = new Date();
  const monthStartDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  const initialStart = format(monthStartDate, "yyyy-MM-dd");
  const initialEnd = format(todayDate, "yyyy-MM-dd");
  const [appliedRange, setAppliedRange] = useState({ start: initialStart, end: initialEnd });
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  
  const initials = user?.name ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "?";

  const loadStats = useCallback(async (start, end, options = {}) => {
    const { silent = false } = options;
    if (!silent) setLoading(true);
    try {
      const res = await api.get("/dashboard/stats", {
        params: { start_date: start, end_date: end },
      });
      setStats(res.data);
      return res.data;
    } catch (err) {
      console.error("Error loading stats:", err);
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const refresh = () => loadStats(appliedRange.start, appliedRange.end, { silent: true });
    window.addEventListener('clickagenda:appointments-changed', refresh);
    return () => window.removeEventListener('clickagenda:appointments-changed', refresh);
  }, [loadStats, appliedRange]);

  useEffect(() => {
    loadStats(appliedRange.start, appliedRange.end);
  }, [appliedRange, loadStats]);



  const applyRange = (start, end) => {
    if (!start || !end || start > end) {
      toast.error("Escolha um período válido: a data final deve ser igual ou posterior à inicial.");
      return;
    }
    setStartDate(start);
    setEndDate(end);
    setAppliedRange({ start, end });
    setFilterOpen(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 bg-muted rounded animate-pulse mb-8" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 bg-muted rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const confirmationRate = stats?.confirmation_rate || 0;

  return (
    <div className="space-y-8 font-sans pb-10" data-testid="dashboard-page">
      <OnboardingWizard open={showOnboarding} onComplete={() => setShowOnboarding(false)} />
      
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black font-heading text-foreground tracking-tight">Sua agenda em resumo</h1>
          <p className="text-sm text-muted-foreground font-medium mt-1">Bem-vindo de volta, {(user?.name || "").split(" ")[0]}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          
          {user?.slug && (
            <Button variant="outline" className="rounded-full h-[42px] font-bold border-border/60 bg-white text-foreground hover:bg-neutral-50 shadow-sm transition-all" onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/p/${user.slug}`);
              toast.success("Link copiado!");
            }}>
              <Share2 className="h-4 w-4 mr-2 text-muted-foreground" /> Compartilhar Link
            </Button>
          )}

          <Link to="/agenda">
            <Button className="rounded-full h-[42px] bg-[#00D49D] hover:bg-[#00B98A] text-white font-bold px-5 shadow-lg shadow-[#00D49D]/20 active:scale-95 transition-all">
              <Plus className="h-4 w-4 mr-1.5" /> Novo Horario
            </Button>
          </Link>
          
          <div className="h-10 w-px bg-border/50 mx-1 hidden md:block" />
          
          <Avatar className="h-[42px] w-[42px] border-2 border-white shadow-sm shrink-0">
            <AvatarImage src={user?.picture} />
            <AvatarFallback className="bg-primary/5 text-primary font-bold text-sm tracking-widest">{initials}</AvatarFallback>
          </Avatar>
        </div>
      </div>

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-xl">Filtrar Metricas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Data inicial</p>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-xl h-11 border-border/60" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Data final</p>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-xl h-11 border-border/60" />
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-2">
              <Button variant="outline" size="sm" className="h-9 rounded-lg font-semibold border-border/60" onClick={() => {
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - 6);
                applyRange(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
              }}>Ultimos 7 dias</Button>
              <Button variant="outline" size="sm" className="h-9 rounded-lg font-semibold border-border/60" onClick={() => {
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - 29);
                applyRange(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
              }}>Ultimos 30 dias</Button>
              <Button variant="outline" size="sm" className="h-9 rounded-lg font-semibold border-border/60" onClick={() => {
                const end = new Date();
                const start = new Date(end.getFullYear(), end.getMonth(), 1);
                applyRange(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
              }}>Este mes</Button>
            </div>
          </div>
          <DialogFooter className="mt-2 text-right flex items-center justify-end gap-2">
            <Button variant="ghost" className="font-bold text-muted-foreground rounded-xl h-11" onClick={() => setFilterOpen(false)}>Cancelar</Button>
            <Button className="bg-[#00D49D] hover:bg-[#00B98A] text-white font-bold rounded-xl h-11 px-6 shadow-md shadow-[#00D49D]/20 active:scale-95 transition-all" onClick={() => applyRange(startDate, endDate)}>
              Aplicar Filtro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-sm border-border/50 rounded-2xl flex flex-col justify-between">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 rounded-xl bg-[#00D49D]/10 flex items-center justify-center shrink-0">
                <CalendarDays className="h-5 w-5 text-[#00D49D]" />
              </div>
            </div>
            <p className="text-[13px] text-[#64748B] font-semibold tracking-wide mb-1">Agendamentos Hoje</p>
            <p className="text-3xl font-black font-heading text-foreground">{stats?.appointments_today || 0}</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-border/50 rounded-2xl flex flex-col justify-between">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            <p className="text-[13px] text-[#64748B] font-semibold tracking-wide mb-1">Taxa de Confirmação (30d)</p>
            <p className="text-3xl font-black font-heading text-foreground">{confirmationRate}%</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-border/50 rounded-2xl flex flex-col justify-between">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                <DollarSign className="h-5 w-5 text-purple-600" />
              </div>
              <Badge variant="secondary" className="bg-neutral-100 text-muted-foreground hover:bg-neutral-100 font-bold border-transparent text-[11px] px-2 py-0.5">
                Mensal
              </Badge>
            </div>
            <p className="text-[13px] text-[#64748B] font-semibold tracking-wide mb-1">Faturamento Mês Atual</p>
            <p className="text-3xl font-black font-heading text-foreground">R$ {(stats?.monthly_revenue || 0).toFixed(2).replace(".", ",")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Bottom Section */}
      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Left Col */}
        <div className="lg:col-span-2 space-y-6 flex flex-col">
          {/* Recent Appointments Table */}
          <Card className="shadow-sm border-border/50 rounded-2xl overflow-hidden h-full flex flex-col">
            <CardHeader className="pb-4 pt-5 px-6 border-b border-border/30 bg-white">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="font-heading text-[17px] font-black tracking-tight">Agendamentos Recentes</CardTitle>
                <div className="flex items-center gap-2">
                   <Button variant="outline" size="sm" className="rounded-full h-8 px-4 text-[12px] font-bold border-border/60 hover:bg-neutral-50" onClick={() => setFilterOpen(true)}>
                     Filtrar Data
                   </Button>
                   <Link to="/agenda">
                     <Button variant="outline" size="sm" className="rounded-full h-8 px-4 text-[12px] font-bold border-border/60 hover:bg-neutral-50">
                       Ver Todos
                     </Button>
                   </Link>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 bg-white">
               <div className="divide-y sm:hidden">
                 {!stats?.recent_appointments?.length && <p className="p-6 text-sm text-muted-foreground">Nenhum agendamento neste período.</p>}
                 {stats?.recent_appointments?.map(apt => <Link key={apt.appointment_id} to={'/agenda?date=' + apt.date} className="flex min-w-0 items-center gap-3 p-4"><div className="min-w-0 flex-1"><strong className="block break-words text-sm">{apt.client_name}</strong><p className="mt-1 break-words text-xs text-muted-foreground">{apt.service_name}</p><p className="mt-2 text-xs">{displayDate(apt.date)} · {apt.start_time}</p><Badge variant="outline" className="mt-2">{statusLabels[apt.status] || apt.status}</Badge></div><ArrowRight className="h-5 w-5 shrink-0 text-primary" /></Link>)}
               </div>
               <div className="hidden sm:block overflow-x-auto h-full">
                 <table className="w-full text-sm text-left">
                   <thead className="text-[10px] text-[#64748B] font-black tracking-widest uppercase bg-neutral-50/50 border-b border-border/30">
                     <tr>
                       <th className="px-6 py-4 font-black">Cliente</th>
                       <th className="px-6 py-4 font-black">Servico</th>
                       <th className="px-6 py-4 font-black">Data/Hora</th>
                       <th className="px-6 py-4 font-black">Status</th>
                       <th className="px-6 py-4 font-black text-right">Acoes</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-border/30">
                     {(!stats?.recent_appointments?.length) ? (
                        <tr>
                          <td colSpan="5" className="text-center py-16 px-4">
                            <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
                            <p className="text-[13px] font-medium text-[#64748B]">Nenhum agendamento recente para o periodo selecionado.</p>
                          </td>
                        </tr>
                     ) : (
                       stats.recent_appointments.map((apt) => {
                         const aptInitials = apt.client_name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase();
                         
                         let badgeClasses = "bg-neutral-100 text-neutral-600";
                         if (apt.status === "confirmed" || apt.status === "completed") badgeClasses = "bg-emerald-50 text-emerald-600";
                         else if (apt.status === "pending" || apt.status === "scheduled") badgeClasses = "bg-blue-50 text-blue-600";
                         else if (apt.status === "cancelled" || apt.status === "no_show") badgeClasses = "bg-red-50 text-red-600";
                         
                         return (
                           <tr key={apt.appointment_id} className="hover:bg-neutral-50/70 transition-colors bg-white">
                             <td className="px-6 py-4">
                               <div className="flex items-center gap-3">
                                 <Avatar className="h-[34px] w-[34px]">
                                   <AvatarFallback className="bg-primary/5 text-primary text-[11px] font-bold">{aptInitials}</AvatarFallback>
                                 </Avatar>
                                 <p className="font-bold text-foreground text-[13px]">{apt.client_name}</p>
                               </div>
                             </td>
                             <td className="px-6 py-4 font-semibold text-[#64748B] text-[13px]">{apt.service_name}</td>
                             <td className="px-6 py-4 font-semibold text-[#64748B] text-[13px]">{apt.date} as {apt.start_time}</td>
                             <td className="px-6 py-4">
                               <Badge variant="outline" className={`status-badge text-[9px] px-2 py-0.5 font-bold tracking-widest border-transparent uppercase ${badgeClasses}`}>
                                 {statusLabels[apt.status] || apt.status}
                               </Badge>
                             </td>
                             <td className="px-6 py-4 text-right">
                               <Link to="/agenda">
                                 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/5">
                                   <ArrowRight className="h-4 w-4" />
                                 </Button>
                               </Link>
                             </td>
                           </tr>
                         )
                       })
                     )}
                   </tbody>
                 </table>
               </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Col */}
        <div className="space-y-6 flex flex-col">
          <Card className="shadow-sm border-border/50 rounded-2xl flex-1 flex flex-col">
            <CardHeader className="pb-4 pt-5 px-5 border-b border-border/30 bg-white rounded-t-2xl">
              <div className="flex items-center justify-between">
                <CardTitle className="font-heading text-[17px] font-black tracking-tight">Próximos clientes</CardTitle>
                <Link to="/agenda" className="text-[12px] font-bold text-[#00D49D] hover:underline">Ver todos</Link>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 bg-white rounded-b-2xl">
              <div className="divide-y divide-border/30 h-full">
                {!stats?.upcoming_clients?.length ? (
                  <div className="py-12 px-4 flex flex-col items-center text-center">
                     <Clock className="h-8 w-8 text-muted-foreground/30 mb-3" />
                     <p className="text-[13px] font-medium text-[#64748B]">Sua agenda futura esta livre no momento.</p>
                  </div>
                ) : (
                  stats.upcoming_clients.map((apt) => {
                    const aptInitials = apt.client_name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase();
                    return (
                      <Link key={apt.appointment_id} to={'/agenda?date=' + apt.date} className="flex min-w-0 items-center justify-between p-5 hover:bg-neutral-50/70 transition-colors">
                        <div className="flex min-w-0 items-center gap-3.5">
                           <Avatar className="h-[42px] w-[42px]">
                             <AvatarFallback className="bg-primary/5 text-primary text-[12px] font-bold">{aptInitials}</AvatarFallback>
                           </Avatar>
                           <div className="min-w-0 break-words">
                             <p className="font-bold text-[14px] leading-snug text-foreground">{apt.client_name}</p>
                             <p className="text-[12px] text-[#64748B] font-semibold mt-0.5">{displayDate(apt.date)} às {apt.start_time} • {apt.service_name}</p>
                           </div>
                        </div>
                      </Link>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {user?.slug && (
            <Card className="shadow-sm border-[#00D49D]/20 bg-[#00D49D]/[0.02] rounded-2xl shrink-0">
              <CardContent className="p-5">
                <p className="text-[10px] text-[#00D49D] font-black tracking-widest uppercase mb-2.5 flex items-center gap-1.5">
                  <LinkIcon className="h-3 w-3 stroke-[3]" /> Status do Link
                </p>
                <div className="flex items-center justify-between bg-white border border-[#00D49D]/20 rounded-xl px-3.5 py-2.5 shadow-sm">
                  <p className="font-bold text-[13px] text-foreground truncate">
                    {window.location.host}/p/{user.slug}
                  </p>
                  <Button variant="ghost" size="icon" className="h-[28px] w-[28px] rounded-lg text-[#00D49D] hover:bg-[#00D49D]/10 shrink-0 ml-2" onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/p/${user.slug}`);
                    toast.success("Link copiado!");
                  }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        
      </div>
    </div>
  );
}
