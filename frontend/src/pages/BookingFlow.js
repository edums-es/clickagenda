import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  CalendarDays,
  Clock,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Scissors,
  User,
  Phone,
  Mail,
  MessageSquare,
  MessageCircle,
} from "lucide-react";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const STEPS = ["Servico", "Data e horario", "Seus dados", "Confirmacao"];
const confirmationStatusLabels = {
  scheduled: "Aguardando confirmacao",
  confirmed: "Confirmado",
  arrived: "Chegou",
  in_progress: "Em atendimento",
  completed: "Concluido",
  cancelled: "Cancelado",
  no_show: "Faltou",
};

export default function BookingFlow() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const { user, updateUser } = useAuth();
  const preSelectedService = searchParams.get("service");

  const [step, setStep] = useState(0);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [clientInfo, setClientInfo] = useState({ name: "", phone: "", email: "", notes: "" });
  const [booking, setBooking] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const isClientUser = user?.role === "client";

  const loadProfile = useCallback(async () => {
    try {
      const res = await api.get(`/public/${slug}`);
      setProfileData(res.data);
      if (preSelectedService) {
        const svc = res.data.services.find((s) => s.service_id === preSelectedService);
        if (svc) {
          setSelectedService(svc);
          setStep(1);
        }
      }
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [slug, preSelectedService]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!isClientUser) return;
    setClientInfo((prev) => ({
      ...prev,
      name: user?.name || prev.name,
      phone: user?.phone || prev.phone,
      email: user?.email || prev.email,
    }));
  }, [isClientUser, user]);

  const loadSlots = async (date) => {
    if (!selectedService) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const res = await api.get(`/public/${slug}/slots?date=${dateStr}&service_id=${selectedService.service_id}`);
      setSlots(res.data.slots || []);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleDateSelect = (date) => {
    if (!date) return;
    setSelectedDate(date);
    loadSlots(date);
  };

  const handleBook = async () => {
    if (!clientInfo.name || !clientInfo.phone) {
      toast.error("Nome e telefone sao obrigatorios");
      return;
    }
    setBooking(true);
    try {
      const res = await api.post(`/public/${slug}/book`, {
        service_id: selectedService.service_id,
        client_name: clientInfo.name,
        client_phone: clientInfo.phone,
        client_email: clientInfo.email,
        date: format(selectedDate, "yyyy-MM-dd"),
        start_time: selectedSlot.start_time,
        notes: clientInfo.notes,
      });
      if (isClientUser) {
        const profilePayload = {};
        if (!user?.phone && clientInfo.phone) profilePayload.phone = clientInfo.phone;
        if (!user?.email && clientInfo.email) profilePayload.email = clientInfo.email;
        if (!user?.name && clientInfo.name) profilePayload.name = clientInfo.name;
        if (Object.keys(profilePayload).length > 0) {
          const profileRes = await api.put("/profile", profilePayload);
          updateUser(profileRes.data);
        }
      }
      if (!user) {
        localStorage.setItem(
          "pending_client_register",
          JSON.stringify({ name: clientInfo.name, phone: clientInfo.phone, email: clientInfo.email })
        );
      }
      setConfirmation(res.data);
      setStep(3);
      toast.success("Agendamento realizado!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erro ao agendar. Tente outro horario.");
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profileData) return null;
  const { professional, services } = profileData;
  const getWhatsappLink = () => {
    if (!confirmation || !professional) return "";
    const raw =
      professional?.social_links?.whatsapp ||
      professional?.phone ||
      "";
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    const message = [
      `Resumo do agendamento - ${professional.business_name || professional.name}`,
      `Servico: ${confirmation.service_name}`,
      `Data: ${confirmation.date}`,
      `Horario: ${confirmation.start_time} - ${confirmation.end_time}`,
      `Cliente: ${confirmation.client_name || clientInfo.name}`,
      `WhatsApp: ${confirmation.client_phone || clientInfo.phone}`,
    ]
      .filter(Boolean)
      .join("\n");
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  };
  const whatsappLink = getWhatsappLink();

  return (
    <div className="min-h-screen bg-background" data-testid="booking-flow-page">
      {/* Header */}
      <div className="glass-nav sticky top-0 z-50 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link to={`/p/${slug}`}>
            <Button variant="ghost" size="icon" data-testid="booking-back-btn">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <p className="font-heading font-semibold text-sm">
              {professional.business_name || professional.name}
            </p>
            <p className="text-xs text-muted-foreground">Agendamento</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-6">
        <Card className="shadow-soft">
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center gap-2">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div
                    className={`h-2 flex-1 rounded-full transition-colors ${
                      i <= step ? "bg-primary" : "bg-muted"
                    }`}
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Passo {step + 1} de {STEPS.length}</p>
                <h2 className="font-heading text-xl font-semibold" data-testid="step-title">
                  {STEPS[step]}
                </h2>
              </div>
              {selectedService && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{selectedService.name}</span>
                  {selectedService.duration_minutes ? ` · ${selectedService.duration_minutes} min` : ""}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Steps */}
      <div className="max-w-4xl mx-auto px-4 pb-32 animate-fade-in">
        {/* Step 0: Service selection */}
        {step === 0 && (
          <div className="space-y-4" data-testid="step-service">
            <div className="grid sm:grid-cols-2 gap-3">
              {services.map((svc, i) => (
                <Card
                  key={svc.service_id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedService?.service_id === svc.service_id
                      ? "border-primary shadow-md"
                      : "border-border"
                  }`}
                  onClick={() => setSelectedService(svc)}
                  data-testid={`booking-service-${i}`}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Scissors className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{svc.name}</p>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {svc.duration_minutes}min
                          </span>
                          {svc.price > 0 && <span>R$ {svc.price.toFixed(2)}</span>}
                        </div>
                      </div>
                      {selectedService?.service_id === svc.service_id && (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Button
              onClick={() => selectedService && setStep(1)}
              disabled={!selectedService}
              data-testid="step-next-btn"
              className="w-full mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Continuar <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 1: Date + Time */}
        {step === 1 && (
          <div className="space-y-6" data-testid="step-datetime">
            {selectedService && (
              <Card className="shadow-soft">
                <CardContent className="pt-5">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Scissors className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{selectedService.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedService.duration_minutes} min
                        {selectedService.price > 0 ? ` · R$ ${selectedService.price.toFixed(2)}` : ""}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setStep(0)}>
                      Trocar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            <Card className="shadow-soft">
              <CardContent className="pt-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  locale={ptBR}
                  disabled={(date) => isBefore(date, startOfDay(new Date()))}
                  className="rounded-md mx-auto"
                />
              </CardContent>
            </Card>

            {selectedDate && (
              <div>
                <p className="text-sm font-medium mb-3">
                  Horarios para {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                </p>
                {loadingSlots ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum horario disponivel neste dia
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slots.map((slot, i) => (
                      <button
                        key={slot.start_time}
                        onClick={() => setSelectedSlot(slot)}
                        data-testid={`time-slot-${i}`}
                        className={`h-10 rounded-lg border text-sm font-medium transition-all active:scale-95 ${
                          selectedSlot?.start_time === slot.start_time
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:border-primary/30 hover:bg-primary/5"
                        }`}
                      >
                        {slot.start_time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(0)} data-testid="step-prev-btn" className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              <Button
                onClick={() => selectedSlot && setStep(2)}
                disabled={!selectedSlot}
                data-testid="step-next-btn"
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Continuar <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Client info */}
        {step === 2 && (
          <div className="space-y-4" data-testid="step-client-info">
            <Card className="shadow-soft">
              <CardContent className="pt-6 space-y-4">
                {isClientUser && (
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Seus dados foram preenchidos com base no seu perfil.
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Nome completo *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={clientInfo.name}
                      onChange={(e) => setClientInfo((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Seu nome"
                      data-testid="booking-client-name"
                      className="pl-10"
                      disabled={isClientUser && !!user?.name}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={clientInfo.phone}
                      onChange={(e) => setClientInfo((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="(11) 99999-9999"
                      data-testid="booking-client-phone"
                      className="pl-10"
                      disabled={isClientUser && !!user?.phone}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email (opcional)</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={clientInfo.email}
                      onChange={(e) => setClientInfo((p) => ({ ...p, email: e.target.value }))}
                      placeholder="seu@email.com"
                      data-testid="booking-client-email"
                      className="pl-10"
                      disabled={isClientUser && !!user?.email}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Observacoes (opcional)</Label>
                  <div className="relative">
                    <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Textarea
                      value={clientInfo.notes}
                      onChange={(e) => setClientInfo((p) => ({ ...p, notes: e.target.value }))}
                      placeholder="Alguma observacao para o profissional?"
                      rows={3}
                      data-testid="booking-client-notes"
                      className="pl-10"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card className="shadow-soft bg-primary/5 border-primary/20">
              <CardContent className="py-4">
                <p className="text-xs font-medium text-primary mb-2">Resumo</p>
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Servico:</span> {selectedService?.name}</p>
                  <p><span className="text-muted-foreground">Data:</span> {selectedDate && format(selectedDate, "dd/MM/yyyy")}</p>
                  <p><span className="text-muted-foreground">Horario:</span> {selectedSlot?.start_time} - {selectedSlot?.end_time}</p>
                  {selectedService?.price > 0 && (
                    <p><span className="text-muted-foreground">Valor:</span> R$ {selectedService.price.toFixed(2)}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} data-testid="step-prev-btn" className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              <Button
                onClick={handleBook}
                disabled={booking || !clientInfo.name || !clientInfo.phone}
                data-testid="confirm-booking-btn"
                className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90"
              >
                {booking ? "Agendando..." : "Confirmar agendamento"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && confirmation && (
          <div className="space-y-6" data-testid="step-confirmation">
            <div className="rounded-2xl border border-border bg-gradient-to-r from-teal-50 to-stone-100 p-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Agendamento confirmado para enviar</p>
                  <h3 className="font-heading text-2xl font-bold mt-1">Tudo certo!</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Aguardando confirmacao do profissional. Voce sera avisado quando houver atualizacao.
                  </p>
                </div>
                <span className={`status-badge status-${confirmation.status} text-xs px-3 py-1`}>
                  {confirmationStatusLabels[confirmation.status] || confirmation.status}
                </span>
              </div>
            </div>

            <Card className="shadow-soft text-left">
              <CardContent className="pt-6 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Servico</p>
                    <p className="font-medium">{confirmation.service_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Profissional</p>
                    <p className="font-medium">{professional.business_name || professional.name}</p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-3 gap-3 pt-2">
                  <div className="rounded-lg border border-border/70 p-3">
                    <p className="text-xs text-muted-foreground">Data</p>
                    <p className="font-medium">{confirmation.date}</p>
                  </div>
                  <div className="rounded-lg border border-border/70 p-3">
                    <p className="text-xs text-muted-foreground">Horario</p>
                    <p className="font-medium">{confirmation.start_time} - {confirmation.end_time}</p>
                  </div>
                  <div className="rounded-lg border border-border/70 p-3">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-medium">{confirmationStatusLabels[confirmation.status] || confirmation.status}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid sm:grid-cols-2 gap-3">
              {confirmation.token && (
                <Link to={`/agendamento/${confirmation.token}`}>
                  <Button variant="outline" className="w-full" data-testid="manage-appointment-link">
                    Gerenciar agendamento
                  </Button>
                </Link>
              )}
              {whatsappLink && (
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                  <Button className="gap-2 w-full" data-testid="whatsapp-summary-btn">
                    <MessageCircle className="h-4 w-4" />
                    Enviar resumo no WhatsApp
                  </Button>
                </a>
              )}
            </div>

            {!user && (
              <Link to="/register">
                <Button variant="outline" className="w-full" data-testid="guest-register-cta">
                  Criar conta para acompanhar
                </Button>
              </Link>
            )}

            <Link to={`/p/${slug}`}>
              <Button variant="ghost" className="w-full" data-testid="back-to-profile-btn">
                Voltar ao perfil
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
