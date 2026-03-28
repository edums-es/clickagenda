import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Bot, Smartphone, QrCode, RefreshCcw, Unplug } from "lucide-react";
import { toast } from "sonner";

export default function WhatsappIA() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get("/whatsapp/config");
      setConfig(res.data);
    } catch (err) {
      console.error("Error loading whatsapp data", err);
      toast.error("Erro ao carregar configurações do WhatsApp.");
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await api.post("/whatsapp/config", {
        n8n_url: config.n8n_url,
        n8n_api_key: config.n8n_api_key,
        whatsapp_number: config.whatsapp_number,
        is_active: config.is_active,
        ai_prompt: config.ai_prompt
      });
      setConfig({ ...config, ...res.data });
      toast.success("Configurações salvas com sucesso!");
    } catch (err) {
      toast.error("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Carregando modulo WhatsApp IA...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight">WhatsApp IA (N8N)</h1>
        <p className="text-sm text-muted-foreground mt-1">Integre seu fluxo do N8N para automação completa com IA.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Card Configuração N8N */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" /> Integração N8N
            </CardTitle>
            <CardDescription>
              Configure o endpoint da sua instância N8N e as chaves de acesso.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>URL do seu N8N</Label>
              <Input 
                placeholder="https://n8n.suavps.com" 
                value={config?.n8n_url || ""}
                onChange={(e) => setConfig({ ...config, n8n_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>API Key N8N (Opcional)</Label>
              <Input 
                type="password"
                placeholder="Sua chave de API"
                value={config?.n8n_api_key || ""}
                disabled
              />
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Gerada automaticamente pelo SalãoZap</p>
            </div>
            <div className="space-y-2">
              <Label>Número WhatsApp conectado</Label>
              <Input 
                placeholder="Ex: 5511999999999"
                value={config?.whatsapp_number || ""}
                onChange={(e) => setConfig({ ...config, whatsapp_number: e.target.value })}
              />
            </div>
            
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/10 space-y-2 mt-4">
              <p className="text-xs font-bold text-primary flex items-center gap-1">
                <QrCode className="h-3 w-3" /> INSTRUÇÕES PARA WEBHOOK
              </p>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">URL de Agendamento (n8n):</p>
                <code className="text-[10px] block bg-white p-2 rounded border border-border overflow-x-auto whitespace-nowrap">
                  {config?.webhook_url}
                </code>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Header de Autenticação:</p>
                <code className="text-[10px] block bg-white p-2 rounded border border-border">
                  X-N8N-Key: {config?.n8n_api_key || 'Salvando p/ gerar...'}
                </code>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card Inteligência */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" /> Configuração da IA
            </CardTitle>
            <CardDescription>
              Defina como a IA deve se comportar. Ela já conhece seus serviços e agenda.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border/50">
              <div className="space-y-0.5">
                <Label className="text-base">Atendimento Ativo</Label>
                <p className="text-xs text-muted-foreground">Ativar/Desativar processamento via SalãoZap.</p>
              </div>
              <Switch 
                checked={config?.is_active || false}
                onCheckedChange={(val) => setConfig({ ...config, is_active: val })}
              />
            </div>

            <div className="space-y-3">
              <Label>Instruções de Comportamento (Prompt)</Label>
              <Textarea 
                className="min-h-[160px] resize-y" 
                value={config?.ai_prompt || ""}
                onChange={(e) => setConfig({ ...config, ai_prompt: e.target.value })}
                placeholder="Ex: Fale de maneira amigável, pergunte como a pessoa está e seja direto."
              />
              <p className="text-xs text-muted-foreground">
                <strong>Dica:</strong> A IA no N8N usará este prompt para guiar a conversa.
              </p>
            </div>

            <Button onClick={saveConfig} disabled={saving} className="w-full">
              {saving ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
