import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ClientConfig() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState({ name: "", phone: "", city: "", state: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || "",
        phone: user.phone || "",
        city: user.city || "",
        state: user.state || "",
      });
    }
  }, [user]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await api.put("/profile", profile);
      updateUser(res.data);
      toast.success("Perfil atualizado!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="client-config-page">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight">Configuracoes</h1>
        <p className="text-sm text-muted-foreground mt-1">Atualize seus dados de contato</p>
      </div>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Perfil do cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} data-testid="client-config-name" />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder="(11) 99999-9999" data-testid="client-config-phone" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={profile.city} onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))} placeholder="Sua cidade" data-testid="client-config-city" />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Input value={profile.state} onChange={(e) => setProfile((p) => ({ ...p, state: e.target.value }))} placeholder="UF" data-testid="client-config-state" />
            </div>
          </div>
          <Button onClick={saveProfile} disabled={saving} data-testid="client-config-save" className="bg-primary text-primary-foreground hover:bg-primary/90">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
