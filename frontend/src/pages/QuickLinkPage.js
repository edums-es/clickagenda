import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CalendarDays, Clock, Scissors, Zap, DollarSign, ArrowRight, CheckCircle2,
  User, Phone, AlertCircle,
} from "lucide-react";
import { format, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function QuickLinkPage() {
  const { code } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [clientInfo, setClientInfo] = useState({ name: "", phone: "", email: "" });
  const [booking, setBooking] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => { loadLink(); }, [code]);

  const loadLink = async () => {
    try {
      const res = await api.get(`/ql/${code}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.status === 410 ? "Este link expirou ou atingiu o limite de usos" : "Link nao encontrado");
    } finally { setLoading(false); }
  };

  const loadSlots = async (date) => {
    if (!data?.professional?.slug || !data?.service?.service_id) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const res = await api.get(`/public/${data.professional.slug}/slots?date=${dateStr}&service_id=${data.service.service_id}`);
      setSlots(res.data.slots || []);
    } catch { setSlots([]); }
    finally { setLoadingSlots(false); }
  };

  const handleDateSelect = (date) => { if (date) { setSelectedDate(date); loadSlots(date); } };

  const handleBook = async () => {
    if (!clientInfo.name || !clientInfo.phone) { toast.error("Nome e telefone sao obrigatorios"); return; }
    setBooking(true);
    try {
      const res = await api.post(`/ql/${code}/book`, {
        service_id: data.service.service_id,
        client_name: clientInfo.name,
        client_phone: clientInfo.phone,
        client_email: clientInfo.email,
        date: format(selectedDate, "yyyy-MM-dd"),
        start_time: selectedSlot.start_time,
      });
      setConfirmation(res.data);
      toast.success("Agendamento realizado com desconto!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erro ao agendar");
    } finally { setBooking(false); }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  if (error) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center">
        <AlertCircle className="h-12 w-12 text-destructive/50 mx-auto mb-4" />
        <h1 className="font-heading text-2xl font-bold">{error}</h1>
        <Link to="/"><Button variant="outline" className="mt-6">Voltar ao inicio</Button></Link>
      </div>
    </div>
  );

  if (confirmation) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4" data-testid="ql-confirmation">
      <div className="max-w-md w-full text-center space-y-6">
        <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
        <h1 className="font-heading text-2xl font-bold">Agendado com desconto!</h1>
        <Card className="shadow-soft text-left">
          <CardContent className="pt-6 space-y-2 text-sm">
            <p><span className="text-muted-foreground">Servico:</span> {confirmation.service_name}</p>
            <p><span className="text-muted-foreground">Data:</span> {confirmation.date}</p>
            <p><span className="text-muted-foreground">Horario:</span> {confirmation.start_time} - {confirmation.end_time}</p>
            <p><span className="text-muted-foreground">Valor:</span> R$ {confirmation.service_price?.toFixed(2)}</p>
          </CardContent>
        </Card>
        {confirmation.token && (
          <Link to={`/agendamento/${confirmation.token}`}>
            <Button variant="outline" size="sm" data-testid="ql-manage-btn">Gerenciar agendamento</Button>
          </Link>
        )}
      </div>
    </div>
  );

  const { professional: pro, service: svc, original_price, discount_price, link } = data;

  return (
    <div className="min-h-screen bg-background" data-testid="quick-link-page">
      {/* Promo Header */}
      <div className="bg-gradient-to-r from-rose-50 to-teal-50 px-4 py-8 border-b border-border">
        <div className="max-w-lg mx-auto text-center">
          <Badge className="bg-secondary text-secondary-foreground mb-4 gap-1">
            <Zap className="h-3 w-3" /> Oferta especial
          </Badge>
          <div className="flex items-center justify-center gap-3 mb-3">
            <Avatar className="h-12 w-12 border-2 border-white shadow">
              <AvatarImage src={pro.picture} />
              <AvatarFallback className="bg-primary text-primary-foreground font-bold">{pro.name?.[0]}</AvatarFallback>
            </Avatar>
            <div className="text-left">
              <p className="font-heading font-semibold">{pro.business_name || pro.name}</p>
              {pro.address && <p className="text-xs text-muted-foreground">{pro.address}</p>}
            </div>
          </div>
          <h1 className="font-heading text-2xl font-bold mt-4">{svc?.name}</h1>
          <div className="flex items-center justify-center gap-3 mt-3">
            <span className="text-muted-foreground line-through text-lg">R$ {original_price?.toFixed(2)}</span>
            <span className="text-2xl font-bold text-secondary">R$ {discount_price?.toFixed(2)}</span>
            <Badge variant="outline" className="text-secondary border-secondary/30">-{link?.discount_percent}%</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {link?.current_uses}/{link?.max_uses} usos | {svc?.duration_minutes}min
          </p>
        </div>
      </div>

      {/* Booking */}
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div>
          <h2 className="font-heading font-semibold mb-3">Escolha a data</h2>
          <Card className="shadow-soft">
            <CardContent className="pt-4">
              <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} locale={ptBR} disabled={(d) => isBefore(d, startOfDay(new Date()))} className="rounded-md mx-auto" />
            </CardContent>
          </Card>
        </div>

        {selectedDate && (
          <div>
            <h2 className="font-heading font-semibold mb-3">Horarios para {format(selectedDate, "dd/MM", { locale: ptBR })}</h2>
            {loadingSlots ? (
              <div className="grid grid-cols-3 gap-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />)}</div>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum horario disponivel</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot, i) => (
                  <button key={slot.start_time} onClick={() => setSelectedSlot(slot)} data-testid={`ql-slot-${i}`}
                    className={`h-10 rounded-lg border text-sm font-medium transition-all active:scale-95 ${selectedSlot?.start_time === slot.start_time ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/30"}`}>
                    {slot.start_time}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedSlot && (
          <div className="space-y-4">
            <h2 className="font-heading font-semibold">Seus dados</h2>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input value={clientInfo.name} onChange={(e) => setClientInfo((p) => ({ ...p, name: e.target.value }))} placeholder="Seu nome" data-testid="ql-name" />
              </div>
              <div className="space-y-1.5">
                <Label>WhatsApp *</Label>
                <Input value={clientInfo.phone} onChange={(e) => setClientInfo((p) => ({ ...p, phone: e.target.value }))} placeholder="(11) 99999-9999" data-testid="ql-phone" />
              </div>
            </div>
            <Button onClick={handleBook} disabled={booking} data-testid="ql-book-btn" className="w-full h-12 bg-secondary text-secondary-foreground hover:bg-secondary/90 text-base font-semibold">
              {booking ? "Agendando..." : `Agendar por R$ ${discount_price?.toFixed(2)}`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
