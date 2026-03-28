import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bot, Smartphone, QrCode, RefreshCcw, Unplug } from "lucide-react";
import { toast } from "sonner";

export default function WhatsappIA() {
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState("DISCONNECTED");
  const [qrCode, setQrCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
    // Poll status every 5 seconds if we are awaiting QR or connecting
    const interval = setInterval(() => {
      checkStatusBackground();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [confRes, statRes] = await Promise.all([
        api.get("/whatsapp/config"),
        api.get("/whatsapp/instance-status")
      ]);
      setConfig(confRes.data);
      setStatus(statRes.data.status);
    } catch (err) {
      console.error("Error loading whatsapp data", err);
      toast.error("Erro ao carregar configurações do WhatsApp.");
    } finally {
      setLoading(false);
    }
  };

  const checkStatusBackground = async () => {
    try {
      const statRes = await api.get("/whatsapp/instance-status");
      if (statRes.data.status) {
        setStatus(statRes.data.status);
        // If it connected, clear QR code
        if (statRes.data.status === "open" || statRes.data.status === "CONNECTED") {
          setQrCode("");
        }
      }
    } catch (err) {
       // ignore background errors
    }
  };

  const connectWhatsapp = async () => {
    setConnecting(true);
    setQrCode("");
    try {
      const res = await api.post("/whatsapp/connect");
      if (res.data.status === "AWAITING_QR") {
        setQrCode(res.data.qr_code);
        setStatus("AWAITING_QR");
        toast.info("Escaneie o QR Code com seu WhatsApp.");
      } else {
        setStatus(res.data.status);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erro ao conectar WhatsApp.");
    } finally {
      setConnecting(false);
    }
  };

  const disconnectWhatsapp = async () => {
    try {
      await api.delete("/whatsapp/disconnect");
      setStatus("DISCONNECTED");
      setQrCode("");
      toast.success("WhatsApp desconectado.");
    } catch (err) {
      toast.error("Erro ao desconectar.");
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await api.put("/whatsapp/config", {
        is_active: config.is_active,
        ai_prompt: config.ai_prompt
      });
      setConfig(res.data);
      toast.success("Configurações da IA salvas com sucesso!");
    } catch (err) {
      toast.error("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Carregando modulo WhatsApp IA...</div>;
  }

  const isConnected = status === "open" || status === "CONNECTED";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight">WhatsApp IA</h1>
        <p className="text-sm text-muted-foreground mt-1">Conecte seu WhatsApp e configure o assistente inteligente.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Card Conexão */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" /> Conexão WhatsApp
            </CardTitle>
            <CardDescription>
              Vincule seu numero para que a IA possa atender seus clientes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border/50">
              <div className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} shadow-sm`} />
                <div>
                  <p className="font-semibold text-sm">Status da Conexão</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
                    {isConnected ? "Conectado" : status === "connecting" ? "Conectando..." : status === "AWAITING_QR" ? "Aguardando Leitura" : "Desconectado"}
                  </p>
                </div>
              </div>
              {isConnected && (
                <Button variant="outline" size="sm" onClick={disconnectWhatsapp} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                  <Unplug className="h-4 w-4 mr-2" /> Desconectar
                </Button>
              )}
            </div>

            {!isConnected && (
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-xl bg-background">
                {status === "connecting" ? (
                  <div className="text-center space-y-4 py-8">
                    <RefreshCcw className="h-12 w-12 text-primary animate-spin mx-auto" />
                    <div>
                      <p className="text-sm font-semibold animate-pulse">Conectando ao WhatsApp...</p>
                      <p className="text-xs text-muted-foreground mt-1">Aguarde um momento, sincronizando as mensagens.</p>
                    </div>
                  </div>
                ) : qrCode ? (
                  <div className="text-center space-y-4">
                    <div className="bg-white p-2 rounded-xl shadow-sm inline-block">
                      <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48 object-contain" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Escaneie o QR Code</p>
                      <p className="text-xs text-muted-foreground mt-1">Abra o WhatsApp &gt; Aparelhos Conectados</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                      <QrCode className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Pronto para conectar?</p>
                      <p className="text-xs text-muted-foreground mt-1">Clique abaixo para gerar o codigo.</p>
                    </div>
                    <Button onClick={connectWhatsapp} disabled={connecting} className="w-full sm:w-auto">
                      {connecting ? <RefreshCcw className="h-4 w-4 mr-2 animate-spin" /> : <Smartphone className="h-4 w-4 mr-2" />}
                      Gerar QR Code
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card Inteligência */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" /> Configuracao da Inteligencia
            </CardTitle>
            <CardDescription>
              Defina como a IA deve se comportar. Ela já conhece seus servicos e agenda automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border/50">
              <div className="space-y-0.5">
                <Label className="text-base">Atendimento por IA</Label>
                <p className="text-xs text-muted-foreground">O agente ira responder novas mensagens.</p>
              </div>
              <Switch 
                checked={config?.is_active || false}
                onCheckedChange={(val) => setConfig({ ...config, is_active: val })}
              />
            </div>

            <div className="space-y-3">
              <Label>Instrucoes de Comportamento (Prompt)</Label>
              <Textarea 
                className="min-h-[160px] resize-y" 
                value={config?.ai_prompt || ""}
                onChange={(e) => setConfig({ ...config, ai_prompt: e.target.value })}
                placeholder="Ex: Fale de maneira amigável, pergunte como a pessoa está e seja direto."
              />
              <p className="text-xs text-muted-foreground">
                <strong>Dica:</strong> A IA já tem os dados de serviços, preços e sua agenda livre. Foque apenas no "tom de voz".
              </p>
            </div>

            <Button onClick={saveConfig} disabled={saving} className="w-full">
              {saving ? "Salvando..." : "Salvar Configuracoes"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
