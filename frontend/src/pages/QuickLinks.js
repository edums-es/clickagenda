import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Link, Copy, Plus, Trash2, Clock, DollarSign, Share2, ExternalLink, Check } from "lucide-react";
import { toast } from "sonner";

export default function QuickLinks() {
  const [links, setLinks] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ service_id: "", discount_percent: 10, expires_hours: 24, max_uses: 5 });
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [linksRes, svcRes] = await Promise.all([api.get("/quick-links"), api.get("/services")]);
      setLinks(linksRes.data);
      setServices(svcRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!form.service_id) { toast.error("Selecione um servico"); return; }
    setCreating(true);
    try {
      await api.post("/quick-links", form);
      toast.success("Link rapido criado!");
      setShowDialog(false);
      setForm({ service_id: "", discount_percent: 10, expires_hours: 24, max_uses: 5 });
      loadData();
    } catch (err) { toast.error(err.response?.data?.detail || "Erro ao criar"); }
    finally { setCreating(false); }
  };

  const handleDelete = async (linkId) => {
    if (!window.confirm("Remover este link?")) return;
    try {
      await api.delete(`/quick-links/${linkId}`);
      toast.success("Link removido");
      loadData();
    } catch { toast.error("Erro ao remover"); }
  };

  const copyLink = (code) => {
    const url = `${window.location.origin}/ql/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedId(code);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isExpired = (expiresAt) => new Date(expiresAt) < new Date();

  return (
    <div className="space-y-6" data-testid="quick-links-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight">Links Rapidos</h1>
          <p className="text-sm text-muted-foreground mt-1">Crie links com desconto para compartilhar nas redes sociais</p>
        </div>
        <Button onClick={() => setShowDialog(true)} data-testid="create-quick-link-btn" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-2">
          <Plus className="h-4 w-4" /> Novo link rapido
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : links.length === 0 ? (
        <Card className="shadow-soft">
          <CardContent className="py-12 text-center">
            <Share2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum link rapido criado</p>
            <p className="text-xs text-muted-foreground mt-1">Crie links com desconto para atrair clientes pelo Instagram e WhatsApp!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {links.map((link, i) => {
            const expired = isExpired(link.expires_at);
            const full = link.current_uses >= link.max_uses;
            return (
              <Card key={link.link_id} className={`shadow-soft stagger-item ${expired || full ? "opacity-60" : ""}`} data-testid={`quick-link-card-${i}`}>
                <CardContent className="py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">{link.service_name}</p>
                        <Badge variant="outline" className="text-secondary border-secondary/30 text-[10px]">
                          -{link.discount_percent}%
                        </Badge>
                        {expired && <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px]">Expirado</Badge>}
                        {full && <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px]">Esgotado</Badge>}
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>{link.current_uses}/{link.max_uses} usos</span>
                        <span>R$ {((link.service_price || 0) * (1 - link.discount_percent / 100)).toFixed(2)}</span>
                        <span>Expira: {new Date(link.expires_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => copyLink(link.code)} data-testid={`copy-link-${i}`} className="gap-1.5">
                        {copiedId === link.code ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedId === link.code ? "Copiado" : "Copiar"}
                      </Button>
                      <a href={`/ql/${link.code}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-8 w-8"><ExternalLink className="h-3.5 w-3.5" /></Button>
                      </a>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(link.link_id)} data-testid={`delete-link-${i}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md" data-testid="quick-link-dialog">
          <DialogHeader><DialogTitle className="font-heading">Novo link rapido</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Servico *</Label>
              <Select value={form.service_id} onValueChange={(v) => setForm((p) => ({ ...p, service_id: v }))}>
                <SelectTrigger data-testid="ql-service-select"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {services.filter((s) => s.active).map((s) => (
                    <SelectItem key={s.service_id} value={s.service_id}>{s.name} - R$ {s.price?.toFixed(2)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Desconto (%)</Label>
                <Input type="number" value={form.discount_percent} onChange={(e) => setForm((p) => ({ ...p, discount_percent: parseInt(e.target.value) || 0 }))} data-testid="ql-discount" />
              </div>
              <div className="space-y-2">
                <Label>Expira em (h)</Label>
                <Input type="number" value={form.expires_hours} onChange={(e) => setForm((p) => ({ ...p, expires_hours: parseInt(e.target.value) || 24 }))} data-testid="ql-expires" />
              </div>
              <div className="space-y-2">
                <Label>Max usos</Label>
                <Input type="number" value={form.max_uses} onChange={(e) => setForm((p) => ({ ...p, max_uses: parseInt(e.target.value) || 1 }))} data-testid="ql-max-uses" />
              </div>
            </div>
            <Button onClick={handleCreate} disabled={creating} data-testid="create-ql-btn" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90">
              {creating ? "Criando..." : "Criar link rapido"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
