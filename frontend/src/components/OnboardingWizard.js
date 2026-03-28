import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { toast } from "sonner";
import { CheckCircle2, ArrowRight, Copy, Share2 } from "lucide-react";

export default function OnboardingWizard({ open, onComplete }) {
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Service
  const [service, setService] = useState({ name: "", duration: "60", price: "" });

  // Step 2: Availability
  const [availability, setAvailability] = useState([
    { day: 0, active: true, start: "09:00", end: "18:00", label: "Segunda" },
    { day: 1, active: true, start: "09:00", end: "18:00", label: "Terca" },
    { day: 2, active: true, start: "09:00", end: "18:00", label: "Quarta" },
    { day: 3, active: true, start: "09:00", end: "18:00", label: "Quinta" },
    { day: 4, active: true, start: "09:00", end: "18:00", label: "Sexta" },
    { day: 5, active: false, start: "09:00", end: "13:00", label: "Sabado" },
    { day: 6, active: false, start: "09:00", end: "13:00", label: "Domingo" },
  ]);

  const handleCreateService = async () => {
    if (!service.name) return toast.error("Nome do servico obrigatorio");
    setLoading(true);
    try {
      await api.post("/services", {
        name: service.name,
        duration_minutes: parseInt(service.duration),
        price: parseFloat(service.price) || 0,
      });
      toast.success("Servico criado!");
      setStep(2);
    } catch (err) {
      toast.error("Erro ao criar servico");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAvailability = async () => {
    setLoading(true);
    try {
      const rules = availability
        .filter((d) => d.active)
        .map((d) => ({
          day_of_week: d.day,
          start_time: d.start,
          end_time: d.end,
          is_active: true,
        }));
      await api.post("/availability", { rules, breaks: [] });
      toast.success("Horarios salvos!");
      setStep(3);
    } catch (err) {
      toast.error("Erro ao salvar horarios");
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      const res = await api.put("/profile", { onboarding_completed: true });
      updateUser(res.data); // Update context
      toast.success("Tudo pronto!");
      onComplete(); // Close modal
    } catch (err) {
      console.error("Erro ao finalizar onboarding:", err);
      // Mesmo com erro, fechar o wizard para nao travar o usuario
      onComplete();
    } finally {
      setLoading(false);
    }
  };

  const publicLink = `${window.location.origin}/p/${user?.slug}`;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-2">
            <span>Passo {step} de 3</span>
            <span>{Math.round((step / 3) * 100)}%</span>
          </div>
          <div className="h-1.5 w-full bg-secondary/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 transition-all duration-500 ease-out"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-heading text-teal-700">Adicione seu primeiro servico</DialogTitle>
              <DialogDescription>
                O que voce oferece? Comece com o principal.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome do servico</Label>
                <Input
                  placeholder="Ex: Corte de Cabelo, Consultoria..."
                  value={service.name}
                  onChange={(e) => setService({ ...service, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duracao</Label>
                  <Select
                    value={service.duration}
                    onValueChange={(v) => setService({ ...service, duration: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="45">45 min</SelectItem>
                      <SelectItem value="60">1 hora</SelectItem>
                      <SelectItem value="90">1h 30min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Preco (R$)</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={service.price}
                    onChange={(e) => setService({ ...service, price: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
                Pular por agora
              </Button>
              <Button onClick={handleCreateService} disabled={loading || !service.name} className="bg-teal-600 hover:bg-teal-700">
                {loading ? "Salvando..." : "Adicionar servico"}
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-heading text-teal-700">Configure seus horarios</DialogTitle>
              <DialogDescription>
                Quando voce esta disponivel para atender?
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {availability.map((day, i) => (
                <div key={i} className="flex items-center justify-between p-2 border rounded-lg bg-card">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={day.active}
                      onCheckedChange={(checked) => {
                        const newAvail = [...availability];
                        newAvail[i].active = checked;
                        setAvailability(newAvail);
                      }}
                    />
                    <span className="font-medium text-sm w-20">{day.label}</span>
                  </div>
                  {day.active && (
                    <div className="flex items-center gap-2 text-sm">
                      <Input
                        type="time"
                        className="h-8 w-24"
                        value={day.start}
                        onChange={(e) => {
                          const newAvail = [...availability];
                          newAvail[i].start = e.target.value;
                          setAvailability(newAvail);
                        }}
                      />
                      <span>ate</span>
                      <Input
                        type="time"
                        className="h-8 w-24"
                        value={day.end}
                        onChange={(e) => {
                          const newAvail = [...availability];
                          newAvail[i].end = e.target.value;
                          setAvailability(newAvail);
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(3)}>
                Pular por agora
              </Button>
              <Button onClick={handleSaveAvailability} disabled={loading} className="bg-teal-600 hover:bg-teal-700">
                {loading ? "Salvando..." : "Salvar horarios"}
              </Button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <DialogHeader>
              <div className="mx-auto bg-teal-100 p-3 rounded-full w-fit mb-2">
                <CheckCircle2 className="h-8 w-8 text-teal-600" />
              </div>
              <DialogTitle className="text-2xl font-heading text-center text-teal-700">Seu link esta pronto! 🎉</DialogTitle>
              <DialogDescription className="text-center">
                Voce esta a um passo de receber agendamentos.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg border flex flex-col items-center gap-3">
                <p className="text-sm font-medium text-muted-foreground">Seu link publico:</p>
                <code className="text-lg font-mono bg-background px-3 py-1 rounded border">
                  slotu.app/p/{user?.slug}
                </code>
              </div>
              
              <div className="grid gap-3">
                <Button 
                  size="lg" 
                  className="w-full bg-teal-600 hover:bg-teal-700 text-lg font-semibold h-12"
                  onClick={() => {
                    navigator.clipboard.writeText(publicLink);
                    toast.success("Link copiado!");
                  }}
                >
                  <Copy className="mr-2 h-5 w-5" /> Copiar link
                </Button>
                
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="w-full border-teal-200 text-teal-700 hover:bg-teal-50 hover:text-teal-800"
                  onClick={() => {
                    const text = `Agende comigo pelo Slotu: ${publicLink}`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                  }}
                >
                  <Share2 className="mr-2 h-5 w-5" /> Compartilhar no WhatsApp
                </Button>
              </div>
            </div>
            <div className="flex justify-center pt-2">
              <Button onClick={handleFinish} disabled={loading} variant="ghost" className="text-muted-foreground hover:text-foreground">
                Ir para o dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
