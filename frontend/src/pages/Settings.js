import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Clock, Globe, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const dayNames = ["Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado", "Domingo"];

export default function Settings() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState({
    name: "",
    business_name: "",
    slug: "",
    phone: "",
    bio: "",
    address: "",
    business_type: "",
    min_advance_hours: 2,
    cancellation_policy_hours: 6,
  });
  const [availability, setAvailability] = useState({ rules: [], breaks: [] });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || "",
        business_name: user.business_name || "",
        slug: user.slug || "",
        phone: user.phone || "",
        bio: user.bio || "",
        address: user.address || "",
        business_type: user.business_type || "",
        min_advance_hours: user.min_advance_hours || 2,
        cancellation_policy_hours: user.cancellation_policy_hours || 6,
      });
    }
    loadAvailability();
  }, [user]);

  const loadAvailability = async () => {
    try {
      const res = await api.get("/availability");
      setAvailability(res.data);
    } catch (err) {
      console.error(err);
    }
  };

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

  const saveAvailability = async () => {
    setSaving(true);
    try {
      await api.post("/availability", availability);
      toast.success("Disponibilidade atualizada!");
    } catch (err) {
      toast.error("Erro ao salvar disponibilidade");
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (dayIndex) => {
    const existing = availability.rules.find((r) => r.day_of_week === dayIndex);
    if (existing) {
      if (existing.is_active) {
        setAvailability((prev) => ({
          ...prev,
          rules: prev.rules.map((r) => r.day_of_week === dayIndex ? { ...r, is_active: false } : r),
        }));
      } else {
        setAvailability((prev) => ({
          ...prev,
          rules: prev.rules.map((r) => r.day_of_week === dayIndex ? { ...r, is_active: true } : r),
        }));
      }
    } else {
      setAvailability((prev) => ({
        ...prev,
        rules: [...prev.rules, { day_of_week: dayIndex, start_time: "09:00", end_time: "18:00", is_active: true }],
      }));
    }
  };

  const updateRuleTime = (dayIndex, field, value) => {
    setAvailability((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => r.day_of_week === dayIndex ? { ...r, [field]: value } : r),
    }));
  };

  const publicUrl = user?.slug ? `${window.location.origin}/p/${user.slug}` : "";

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6" data-testid="settings-page">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight">Configuracoes</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie seu perfil e disponibilidade</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-6" data-testid="settings-tabs">
          <TabsTrigger value="profile" data-testid="tab-profile">
            <User className="h-4 w-4 mr-2" /> Perfil
          </TabsTrigger>
          <TabsTrigger value="availability" data-testid="tab-availability">
            <Clock className="h-4 w-4 mr-2" /> Horarios
          </TabsTrigger>
          <TabsTrigger value="public-page" data-testid="tab-public">
            <Globe className="h-4 w-4 mr-2" /> Pagina publica
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="font-heading text-lg">Dados do perfil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} data-testid="settings-name" />
                </div>
                <div className="space-y-2">
                  <Label>Nome do negocio</Label>
                  <Input value={profile.business_name} onChange={(e) => setProfile((p) => ({ ...p, business_name: e.target.value }))} data-testid="settings-business-name" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder="(11) 99999-9999" data-testid="settings-phone" />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de negocio</Label>
                  <Input value={profile.business_type} onChange={(e) => setProfile((p) => ({ ...p, business_type: e.target.value }))} placeholder="Salao, Clinica, etc." data-testid="settings-business-type" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Endereco</Label>
                <Input value={profile.address} onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))} placeholder="Rua, numero, bairro, cidade" data-testid="settings-address" />
              </div>
              <div className="space-y-2">
                <Label>Bio</Label>
                <Textarea value={profile.bio} onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))} placeholder="Conte um pouco sobre voce e seu trabalho" rows={3} data-testid="settings-bio" />
              </div>
              <Separator />
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Antecedencia minima (horas)</Label>
                  <Input type="number" value={profile.min_advance_hours} onChange={(e) => setProfile((p) => ({ ...p, min_advance_hours: parseInt(e.target.value) || 0 }))} data-testid="settings-min-advance" />
                </div>
                <div className="space-y-2">
                  <Label>Politica de cancelamento (horas)</Label>
                  <Input type="number" value={profile.cancellation_policy_hours} onChange={(e) => setProfile((p) => ({ ...p, cancellation_policy_hours: parseInt(e.target.value) || 0 }))} data-testid="settings-cancel-policy" />
                </div>
              </div>
              <Button onClick={saveProfile} disabled={saving} data-testid="save-profile-btn" className="bg-primary text-primary-foreground hover:bg-primary/90">
                {saving ? "Salvando..." : "Salvar perfil"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Availability Tab */}
        <TabsContent value="availability">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="font-heading text-lg">Horarios de funcionamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {dayNames.map((day, i) => {
                const rule = availability.rules.find((r) => r.day_of_week === i);
                const isActive = rule?.is_active ?? false;
                return (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-3 py-2 border-b border-border last:border-0" data-testid={`day-${i}`}>
                    <div className="flex items-center gap-3 w-36">
                      <Switch checked={isActive} onCheckedChange={() => toggleDay(i)} data-testid={`toggle-day-${i}`} />
                      <span className={`text-sm font-medium ${isActive ? "" : "text-muted-foreground"}`}>{day}</span>
                    </div>
                    {isActive && rule && (
                      <div className="flex items-center gap-2">
                        <Input type="time" value={rule.start_time} onChange={(e) => updateRuleTime(i, "start_time", e.target.value)} className="w-28" data-testid={`start-time-${i}`} />
                        <span className="text-sm text-muted-foreground">ate</span>
                        <Input type="time" value={rule.end_time} onChange={(e) => updateRuleTime(i, "end_time", e.target.value)} className="w-28" data-testid={`end-time-${i}`} />
                      </div>
                    )}
                  </div>
                );
              })}
              <Button onClick={saveAvailability} disabled={saving} data-testid="save-availability-btn" className="bg-primary text-primary-foreground hover:bg-primary/90">
                {saving ? "Salvando..." : "Salvar horarios"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Public Page Tab */}
        <TabsContent value="public-page">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="font-heading text-lg">Pagina publica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Seu link exclusivo</Label>
                <div className="flex gap-2">
                  <Input value={profile.slug} onChange={(e) => setProfile((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} data-testid="settings-slug" className="flex-1" />
                  <Button variant="outline" onClick={copyLink} disabled={!publicUrl} data-testid="copy-link-btn">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                {publicUrl && (
                  <p className="text-xs text-muted-foreground">
                    <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {publicUrl}
                    </a>
                  </p>
                )}
              </div>
              <Button onClick={saveProfile} disabled={saving} data-testid="save-slug-btn" className="bg-primary text-primary-foreground hover:bg-primary/90">
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
