import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Plus, Users, Phone, Mail, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "", tags: [] });
  const [saving, setSaving] = useState(false);

  const loadClients = useCallback(async () => {
    try {
      const res = await api.get(`/clients${search ? `?search=${search}` : ""}`);
      setClients(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(loadClients, 300);
    return () => clearTimeout(t);
  }, [loadClients]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", phone: "", email: "", notes: "", tags: [] });
    setShowDialog(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone || "", email: c.email || "", notes: c.notes || "", tags: c.tags || [] });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name) {
      toast.error("Nome e obrigatorio");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/clients/${editing.client_id}`, form);
        toast.success("Cliente atualizado!");
      } else {
        await api.post("/clients", form);
        toast.success("Cliente adicionado!");
      }
      setShowDialog(false);
      loadClients();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (clientId) => {
    if (!window.confirm("Remover este cliente?")) return;
    try {
      await api.delete(`/clients/${clientId}`);
      toast.success("Cliente removido");
      loadClients();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const initials = (name) =>
    name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6" data-testid="clients-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">{clients.length} clientes cadastrados</p>
        </div>
        <Button
          onClick={openNew}
          data-testid="add-client-btn"
          className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
        >
          <Plus className="h-4 w-4" />
          Novo cliente
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, telefone ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="client-search-input"
          className="pl-10"
        />
      </div>

      {/* Client List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : clients.length === 0 ? (
        <Card className="shadow-soft">
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {clients.map((c, i) => (
            <Card
              key={c.client_id}
              className="shadow-soft stagger-item hover:shadow-md transition-shadow"
              data-testid={`client-card-${i}`}
            >
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                      {initials(c.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{c.name}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-0.5">
                      {c.phone && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" /> {c.phone}
                        </span>
                      )}
                      {c.email && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" /> {c.email}
                        </span>
                      )}
                    </div>
                    {c.tags?.length > 0 && (
                      <div className="flex gap-1 mt-1.5">
                        {c.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(c)}
                      data-testid={`edit-client-${i}`}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(c.client_id)}
                      data-testid={`delete-client-${i}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Client Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md" data-testid="client-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editing ? "Editar cliente" : "Novo cliente"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Nome completo"
                data-testid="client-form-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                  data-testid="client-form-phone"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                  data-testid="client-form-email"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observacoes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Preferencias, alergias, etc."
                rows={3}
                data-testid="client-form-notes"
              />
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              data-testid="save-client-btn"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? "Salvando..." : editing ? "Salvar alteracoes" : "Adicionar cliente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
