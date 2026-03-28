import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  UserCheck,
  Play,
  Ban,
  MessageCircle,
} from "lucide-react";
import { format, addDays, subDays } from "date-fns";
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

const statusActions = [
  { status: "confirmed", label: "Confirmar", icon: CheckCircle2 },
  { status: "arrived", label: "Chegou", icon: UserCheck },
  { status: "in_progress", label: "Atendendo", icon: Play },
  { status: "completed", label: "Concluir", icon: CheckCircle2 },
  { status: "cancelled", label: "Cancelar", icon: XCircle },
  { status: "no_show", label: "Faltou", icon: Ban },
];

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7am to 8pm

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newApt, setNewApt] = useState({
    service_id: "",
    client_name: "",
    client_phone: "",
    client_email: "",
    start_time: "",
    notes: "",
  });
  const [creating, setCreating] = useState(false);
  const [createdApt, setCreatedApt] = useState(null);

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [aptRes, svcRes] = await Promise.all([
        api.get(`/appointments?date=${dateStr}`),
        api.get("/services"),
      ]);
      setAppointments(aptRes.data);
      setServices(svcRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dateStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateStatus = async (aptId, status) => {
    try {
      await api.put(`/appointments/${aptId}/status`, { status });
      toast.success(`Status atualizado: ${statusLabels[status]}`);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erro ao atualizar");
    }
  };

  const handleCreate = async () => {
    if (!newApt.service_id || !newApt.client_name || !newApt.client_phone || !newApt.start_time) {
      toast.error("Preencha todos os campos obrigatorios");
      return;
    }
    setCreating(true);
    try {
      const res = await api.post("/appointments", { ...newApt, date: dateStr });
      toast.success("Agendamento criado!");
      setCreatedApt(res.data);
      setShowNewDialog(false);
      setNewApt({ service_id: "", client_name: "", client_phone: "", client_email: "", start_time: "", notes: "" });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erro ao criar agendamento");
    } finally {
      setCreating(false);
    }
  };

  const getAptForHour = (hour) => {
    return appointments.filter((apt) => {
      const aptHour = parseInt(apt.start_time.split(":")[0], 10);
      return aptHour === hour && apt.status !== "cancelled";
    });
  };

  return (
    <div className="space-y-6" data-testid="calendar-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted-foreground capitalize mt-1">
            {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <Button
          onClick={() => setShowNewDialog(true)}
          data-testid="new-appointment-btn"
          className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
        >
          <Plus className="h-4 w-4" />
          Novo agendamento
        </Button>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Mini Calendar */}
        <Card className="shadow-soft lg:col-span-1" data-testid="mini-calendar">
          <CardContent className="pt-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              locale={ptBR}
              className="rounded-md"
            />
          </CardContent>
        </Card>

        {/* Day View */}
        <Card className="shadow-soft lg:col-span-3" data-testid="day-view">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedDate((d) => subDays(d, 1))}
                  data-testid="prev-day-btn"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="font-heading text-lg">
                  {format(selectedDate, "dd MMM", { locale: ptBR })}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedDate((d) => addDays(d, 1))}
                  data-testid="next-day-btn"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(new Date())}
                data-testid="today-btn"
              >
                Hoje
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-1 custom-scrollbar max-h-[600px] overflow-y-auto">
                {HOURS.map((hour) => {
                  const hourApts = getAptForHour(hour);
                  return (
                    <div key={hour} className="flex gap-3 group min-h-[52px]" data-testid={`hour-${hour}`}>
                      <div className="w-14 text-xs text-muted-foreground pt-2 text-right shrink-0">
                        {`${hour.toString().padStart(2, "0")}:00`}
                      </div>
                      <div className="flex-1 border-t border-border pt-1 pb-1 relative">
                        {hourApts.length === 0 ? (
                          <div className="h-10 rounded-lg border border-dashed border-transparent group-hover:border-border transition-colors" />
                        ) : (
                          <div className="space-y-1">
                            {hourApts.map((apt) => (
                              <Popover key={apt.appointment_id}>
                                <PopoverTrigger asChild>
                                  <div
                                    className={`time-slot border-l-primary cursor-pointer bg-primary/5`}
                                    data-testid={`apt-${apt.appointment_id}`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="min-w-0">
                                        <p className="font-medium text-sm truncate">{apt.client_name}</p>
                                        <p className="text-xs text-muted-foreground truncate">
                                          {apt.start_time} - {apt.end_time} | {apt.service_name}
                                        </p>
                                      </div>
                                      <Badge
                                        variant="outline"
                                        className={`status-badge status-${apt.status} text-[10px] shrink-0 ml-2`}
                                      >
                                        {statusLabels[apt.status]}
                                      </Badge>
                                    </div>
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-2" align="end">
                                  <p className="text-xs font-medium mb-2 px-2">Alterar status</p>
                                  <div className="space-y-0.5">
                                    {statusActions.map((sa) => (
                                      <button
                                        key={sa.status}
                                        onClick={() => updateStatus(apt.appointment_id, sa.status)}
                                        className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors text-left"
                                        data-testid={`status-action-${sa.status}`}
                                      >
                                        <sa.icon className="h-3.5 w-3.5" />
                                        {sa.label}
                                      </button>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Appointment Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-md" data-testid="new-appointment-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Novo agendamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Servico *</Label>
              <Select
                value={newApt.service_id}
                onValueChange={(v) => setNewApt((p) => ({ ...p, service_id: v }))}
              >
                <SelectTrigger data-testid="new-apt-service-select">
                  <SelectValue placeholder="Selecione o servico" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.service_id} value={s.service_id}>
                      {s.name} ({s.duration_minutes}min - R${s.price})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nome do cliente *</Label>
                <Input
                  value={newApt.client_name}
                  onChange={(e) => setNewApt((p) => ({ ...p, client_name: e.target.value }))}
                  placeholder="Nome"
                  data-testid="new-apt-client-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone *</Label>
                <Input
                  value={newApt.client_phone}
                  onChange={(e) => setNewApt((p) => ({ ...p, client_phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                  data-testid="new-apt-client-phone"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Horario *</Label>
              <Input
                type="time"
                value={newApt.start_time}
                onChange={(e) => setNewApt((p) => ({ ...p, start_time: e.target.value }))}
                data-testid="new-apt-time"
              />
            </div>
            <div className="space-y-2">
              <Label>Observacoes</Label>
              <Textarea
                value={newApt.notes}
                onChange={(e) => setNewApt((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Alguma observacao?"
                rows={2}
                data-testid="new-apt-notes"
              />
            </div>
            <Button
              onClick={handleCreate}
              disabled={creating}
              data-testid="create-appointment-btn"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {creating ? "Criando..." : "Criar agendamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={!!createdApt} onOpenChange={() => setCreatedApt(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto bg-green-100 p-3 rounded-full w-fit mb-2">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <DialogTitle className="text-center text-2xl font-heading text-green-700">
              Agendamento criado!
            </DialogTitle>
          </DialogHeader>
          {createdApt && (
            <div className="space-y-6 py-2">
              <Card className="shadow-soft bg-muted/30">
                <CardContent className="pt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Servico:</span>
                    <span className="font-medium">{createdApt.service_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cliente:</span>
                    <span className="font-medium">{createdApt.client_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data:</span>
                    <span className="font-medium">{createdApt.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Horario:</span>
                    <span className="font-medium">
                      {createdApt.start_time} - {createdApt.end_time}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {createdApt.whatsapp_link && (
                  <a
                    href={createdApt.whatsapp_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full block"
                  >
                    <Button className="w-full bg-[#25D366] hover:bg-[#1DA851] text-white font-bold gap-2">
                      <MessageCircle className="h-5 w-5" />
                      Enviar confirmacao para o cliente
                    </Button>
                  </a>
                )}
                <Button variant="outline" className="w-full" onClick={() => setCreatedApt(null)}>
                  Fechar
                </Button>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Toque para enviar o resumo do agendamento para o cliente via WhatsApp.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
