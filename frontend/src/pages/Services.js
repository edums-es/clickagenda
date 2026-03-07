import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Scissors, Clock, DollarSign, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Services() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    duration_minutes: 60,
    price: 0,
    buffer_minutes: 15,
    category: "",
    active: true,
  });
  const [saving, setSaving] = useState(false);

  const loadServices = async () => {
    try {
      const res = await api.get("/services");
      setServices(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", description: "", duration_minutes: 60, price: 0, buffer_minutes: 15, category: "", active: true });
    setShowDialog(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({
      name: s.name,
      description: s.description || "",
      duration_minutes: s.duration_minutes,
      price: s.price,
      buffer_minutes: s.buffer_minutes || 15,
      category: s.category || "",
      active: s.active !== false,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name) {
      toast.error("Nome do servico e obrigatorio");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, price: parseFloat(form.price) || 0, duration_minutes: parseInt(form.duration_minutes) || 60, buffer_minutes: parseInt(form.buffer_minutes) || 0 };
      if (editing) {
        await api.put(`/services/${editing.service_id}`, payload);
        toast.success("Servico atualizado!");
      } else {
        await api.post("/services", payload);
        toast.success("Servico criado!");
      }
      setShowDialog(false);
      loadServices();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (svcId) => {
    if (!window.confirm("Remover este servico?")) return;
    try {
      await api.delete(`/services/${svcId}`);
      toast.success("Servico removido");
      loadServices();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const totalServices = services.length;
  const activeServices = services.filter((s) => s.active !== false).length;
  const avgDuration = services.length
    ? Math.round(services.reduce((acc, s) => acc + (parseInt(s.duration_minutes) || 0), 0) / services.length)
    : 0;
  const avgPrice = services.length
    ? services.reduce((acc, s) => acc + (parseFloat(s.price) || 0), 0) / services.length
    : 0;

  return (
    <div className="space-y-6" data-testid="services-page">
      <div className="rounded-2xl border border-border bg-card/80 p-6 md:p-8 shadow-soft">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/70">Gestao</p>
            <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight mt-2">Servicos</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Organize seus servicos, duracao e precos em um painel rapido.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={openNew}
              data-testid="add-service-btn"
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
            >
              <Plus className="h-4 w-4" />
              Novo servico
            </Button>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <Card className="border-border/70 shadow-none">
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Total de servicos</p>
              <p className="text-2xl font-semibold mt-2">{totalServices}</p>
              <p className="text-xs text-muted-foreground mt-1">Cadastrados no seu catalogo</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-none">
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Servicos ativos</p>
              <p className="text-2xl font-semibold mt-2">{activeServices}</p>
              <p className="text-xs text-muted-foreground mt-1">Visiveis para clientes</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-none">
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Duracao media</p>
              <p className="text-2xl font-semibold mt-2">{avgDuration} min</p>
              <p className="text-xs text-muted-foreground mt-1">Tempo por atendimento</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-none">
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Preco medio</p>
              <p className="text-2xl font-semibold mt-2">R$ {avgPrice.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">Ticket medio</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : services.length === 0 ? (
        <Card className="shadow-soft">
          <CardContent className="py-12 text-center">
            <Scissors className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum servico cadastrado</p>
            <Button variant="link" onClick={openNew} className="mt-2 text-primary" data-testid="empty-add-service">
              Adicionar primeiro servico
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((s, i) => (
            <Card
              key={s.service_id}
              className={`shadow-soft stagger-item transition-all hover:shadow-md hover:-translate-y-1 ${!s.active ? "opacity-60" : ""}`}
              data-testid={`service-card-${i}`}
            >
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Scissors className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)} data-testid={`edit-service-${i}`}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(s.service_id)} data-testid={`delete-service-${i}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <h3 className="font-semibold text-sm">{s.name}</h3>
                {s.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>}
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {s.duration_minutes}min
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> R$ {s.price?.toFixed(2)}
                  </span>
                </div>
                {!s.active && (
                  <span className="inline-block mt-2 text-[10px] font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                    Inativo
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Service Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md" data-testid="service-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editing ? "Editar servico" : "Novo servico"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Corte de cabelo" data-testid="service-form-name" />
            </div>
            <div className="space-y-2">
              <Label>Descricao</Label>
              <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Descricao do servico" rows={2} data-testid="service-form-description" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Duracao (min)</Label>
                <Input type="number" value={form.duration_minutes} onChange={(e) => setForm((p) => ({ ...p, duration_minutes: e.target.value }))} data-testid="service-form-duration" />
              </div>
              <div className="space-y-2">
                <Label>Preco (R$)</Label>
                <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} data-testid="service-form-price" />
              </div>
              <div className="space-y-2">
                <Label>Intervalo (min)</Label>
                <Input type="number" value={form.buffer_minutes} onChange={(e) => setForm((p) => ({ ...p, buffer_minutes: e.target.value }))} data-testid="service-form-buffer" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} placeholder="Ex: Cabelo, Unha, Barba" data-testid="service-form-category" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch checked={form.active} onCheckedChange={(v) => setForm((p) => ({ ...p, active: v }))} data-testid="service-form-active" />
            </div>
            <Button onClick={handleSave} disabled={saving} data-testid="save-service-btn" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              {saving ? "Salvando..." : editing ? "Salvar alteracoes" : "Criar servico"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
