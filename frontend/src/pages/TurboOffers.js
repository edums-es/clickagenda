import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Zap, Plus, Trash2, Clock, DollarSign, CalendarDays, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function TurboOffers() {
  const [offers, setOffers] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ service_id: "", date: "", start_time: "", discount_percent: 20, expires_hours: 24 });
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [offersRes, svcRes] = await Promise.all([api.get("/turbo-offers"), api.get("/services")]);
      setOffers(offersRes.data);
      setServices(svcRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!form.service_id || !form.date || !form.start_time) {
      toast.error("Preencha servico, data e horario");
      return;
    }
    setCreating(true);
    try {
      await api.post("/turbo-offers", form);
      toast.success("Oferta turbo criada!");
      setShowDialog(false);
      setForm({ service_id: "", date: "", start_time: "", discount_percent: 20, expires_hours: 24 });
      loadData();
    } catch (err) { toast.error(err.response?.data?.detail || "Erro ao criar"); }
    finally { setCreating(false); }
  };

  const handleDelete = async (offerId) => {
    if (!window.confirm("Remover esta oferta?")) return;
    try {
      await api.delete(`/turbo-offers/${offerId}`);
      toast.success("Oferta removida");
      loadData();
    } catch { toast.error("Erro ao remover"); }
  };

  const isExpired = (expiresAt) => new Date(expiresAt) < new Date();

  return (
    <div className="space-y-6" data-testid="turbo-offers-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight">Turbo Preenchimento</h1>
          <p className="text-sm text-muted-foreground mt-1">Preencha horarios vagos com ofertas relampago</p>
        </div>
        <Button onClick={() => setShowDialog(true)} data-testid="create-turbo-btn" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-2">
          <Zap className="h-4 w-4" /> Nova oferta turbo
        </Button>
      </div>

      {/* Info Banner */}
      <Card className="bg-gradient-to-r from-rose-50 to-teal-50 border-secondary/20 shadow-soft">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <p className="font-medium text-sm">Como funciona o Turbo Preenchimento?</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Identifique horarios vagos na sua agenda, crie ofertas com desconto e compartilhe no WhatsApp ou Instagram. 
                Quando alguem reservar, a oferta desaparece automaticamente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : offers.length === 0 ? (
        <Card className="shadow-soft">
          <CardContent className="py-12 text-center">
            <Zap className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma oferta turbo criada</p>
            <p className="text-xs text-muted-foreground mt-1">Crie ofertas para horarios vagos e atraia mais clientes!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {offers.map((offer, i) => {
            const expired = isExpired(offer.expires_at);
            const booked = offer.status === "booked";
            return (
              <Card key={offer.offer_id} className={`shadow-soft stagger-item ${expired || booked ? "opacity-60" : ""}`} data-testid={`turbo-card-${i}`}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="h-9 w-9 rounded-lg bg-secondary/10 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-secondary" />
                    </div>
                    <div className="flex items-center gap-1">
                      {booked && <Badge className="bg-primary text-primary-foreground text-[10px]">Reservado</Badge>}
                      {expired && !booked && <Badge variant="outline" className="text-destructive text-[10px]">Expirado</Badge>}
                      {!expired && !booked && <Badge className="bg-secondary text-secondary-foreground text-[10px]">Ativo</Badge>}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(offer.offer_id)} data-testid={`delete-turbo-${i}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <h3 className="font-semibold text-sm">{offer.service_name}</h3>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {offer.date}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {offer.start_time} - {offer.end_time}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs line-through text-muted-foreground">R$ {offer.original_price?.toFixed(2)}</span>
                    <span className="text-sm font-bold text-secondary">R$ {offer.offer_price?.toFixed(2)}</span>
                    <Badge variant="outline" className="text-secondary border-secondary/30 text-[10px]">-{offer.discount_percent}%</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md" data-testid="turbo-dialog">
          <DialogHeader><DialogTitle className="font-heading">Nova oferta turbo</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Servico *</Label>
              <Select value={form.service_id} onValueChange={(v) => setForm((p) => ({ ...p, service_id: v }))}>
                <SelectTrigger data-testid="turbo-service-select"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {services.filter((s) => s.active).map((s) => (
                    <SelectItem key={s.service_id} value={s.service_id}>{s.name} - R$ {s.price?.toFixed(2)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} data-testid="turbo-date" />
              </div>
              <div className="space-y-2">
                <Label>Horario *</Label>
                <Input type="time" value={form.start_time} onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))} data-testid="turbo-time" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Desconto (%)</Label>
                <Input type="number" value={form.discount_percent} onChange={(e) => setForm((p) => ({ ...p, discount_percent: parseInt(e.target.value) || 0 }))} data-testid="turbo-discount" />
              </div>
              <div className="space-y-2">
                <Label>Expira em (h)</Label>
                <Input type="number" value={form.expires_hours} onChange={(e) => setForm((p) => ({ ...p, expires_hours: parseInt(e.target.value) || 24 }))} data-testid="turbo-expires" />
              </div>
            </div>
            <Button onClick={handleCreate} disabled={creating} data-testid="create-turbo-submit-btn" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
              {creating ? "Criando..." : "Criar oferta turbo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
