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
    city: "",
    state: "",
    business_type: "",
    picture: "",
    cover_picture: "",
    social_links: {},
    featured_service_ids: [],
    min_advance_hours: 2,
    cancellation_policy_hours: 6,
  });
  const [availability, setAvailability] = useState({ rules: [], breaks: [] });
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [uploading, setUploading] = useState({ picture: false, cover_picture: false });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      const cleanPicture = (user.picture || "").startsWith("data:") ? "" : (user.picture || "");
      const cleanCover = (user.cover_picture || "").startsWith("data:") ? "" : (user.cover_picture || "");
      setProfile({
        name: user.name || "",
        business_name: user.business_name || "",
        slug: user.slug || "",
        phone: user.phone || "",
        bio: user.bio || "",
        address: user.address || "",
        city: user.city || "",
        state: user.state || "",
        business_type: user.business_type || "",
        picture: cleanPicture,
        cover_picture: cleanCover,
        social_links: user.social_links || {},
        featured_service_ids: user.featured_service_ids || [],
        min_advance_hours: user.min_advance_hours || 2,
        cancellation_policy_hours: user.cancellation_policy_hours || 6,
      });
    }
    loadAvailability();
    loadServices();
  }, [user]);

  const loadAvailability = async () => {
    try {
      const res = await api.get("/availability");
      setAvailability(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadServices = async () => {
    try {
      const res = await api.get("/services");
      setServices(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setServicesLoading(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const cleanSocialLinks = Object.entries(profile.social_links || {}).reduce((acc, [key, value]) => {
        const trimmed = (value || "").trim();
        if (trimmed) acc[key] = trimmed;
        return acc;
      }, {});
      const safePicture = (profile.picture || "").startsWith("data:") ? "" : profile.picture;
      const safeCover = (profile.cover_picture || "").startsWith("data:") ? "" : profile.cover_picture;
      const payload = {
        ...profile,
        picture: safePicture,
        cover_picture: safeCover,
        social_links: cleanSocialLinks,
        featured_service_ids: profile.featured_service_ids || [],
      };
      const res = await api.put("/profile", payload);
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

  const parseTimeToMinutes = (value) => {
    if (!value) return 0;
    const [hours, minutes] = value.split(":").map((part) => parseInt(part, 10));
    return (hours || 0) * 60 + (minutes || 0);
  };

  const activeRules = availability.rules.filter((rule) => rule.is_active);
  const totalMinutes = activeRules.reduce((acc, rule) => {
    const start = parseTimeToMinutes(rule.start_time);
    const end = parseTimeToMinutes(rule.end_time);
    return acc + Math.max(0, end - start);
  }, 0);
  const totalHours = totalMinutes > 0 ? (totalMinutes / 60).toFixed(1) : "0";

  const compressImage = (file, options) => new Promise((resolve) => {
    const { maxWidth, maxHeight, quality } = options;
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
      const targetWidth = Math.max(1, Math.round(img.width * ratio));
      const targetHeight = Math.max(1, Math.round(img.height * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(objectUrl);
        if (!blob) {
          resolve(file);
          return;
        }
        resolve(new File([blob], "upload.jpg", { type: "image/jpeg" }));
      }, "image/jpeg", quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });

  const handleImageUpload = async (field, file) => {
    if (!file) return;
    setUploading((prev) => ({ ...prev, [field]: true }));
    try {
      const compressed = field === "cover_picture"
        ? await compressImage(file, { maxWidth: 1600, maxHeight: 900, quality: 0.8 })
        : await compressImage(file, { maxWidth: 600, maxHeight: 600, quality: 0.85 });
      const formData = new FormData();
      formData.append("file", compressed);
      const res = await api.post(`/profile/upload?image_type=${field}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setProfile((prev) => ({ ...prev, [field]: res.data.url || "" }));
      toast.success("Imagem atualizada!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erro ao enviar imagem");
    } finally {
      setUploading((prev) => ({ ...prev, [field]: false }));
    }
  };

  const updateSocialLink = (key, value) => {
    setProfile((prev) => ({ ...prev, social_links: { ...(prev.social_links || {}), [key]: value } }));
  };

  const toggleFeaturedService = (serviceId) => {
    setProfile((prev) => {
      const current = prev.featured_service_ids || [];
      const exists = current.includes(serviceId);
      if (!exists && current.length >= 3) {
        toast.error("Selecione no maximo 3 servicos");
        return prev;
      }
      return {
        ...prev,
        featured_service_ids: exists ? current.filter((id) => id !== serviceId) : [...current, serviceId],
      };
    });
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
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={profile.city} onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))} placeholder="Sua cidade" data-testid="settings-city" />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input value={profile.state} onChange={(e) => setProfile((p) => ({ ...p, state: e.target.value }))} placeholder="UF" data-testid="settings-state" />
                </div>
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
          <div className="space-y-6">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="font-heading text-lg">Horarios de funcionamento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-border/70 p-4">
                    <p className="text-xs text-muted-foreground">Dias ativos</p>
                    <p className="text-2xl font-semibold mt-2">{activeRules.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">Dias com atendimento</p>
                  </div>
                  <div className="rounded-xl border border-border/70 p-4">
                    <p className="text-xs text-muted-foreground">Horas semanais</p>
                    <p className="text-2xl font-semibold mt-2">{totalHours}h</p>
                    <p className="text-xs text-muted-foreground mt-1">Carga aproximada</p>
                  </div>
                  <div className="rounded-xl border border-border/70 p-4">
                    <p className="text-xs text-muted-foreground">Antecedencia minima</p>
                    <p className="text-2xl font-semibold mt-2">{profile.min_advance_hours}h</p>
                    <p className="text-xs text-muted-foreground mt-1">Reserva antecipada</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-soft">
              <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <CardTitle className="font-heading text-lg">Agenda semanal</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Defina horarios padrao por dia</p>
                </div>
                <Button onClick={saveAvailability} disabled={saving} data-testid="save-availability-btn" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  {saving ? "Salvando..." : "Salvar horarios"}
                </Button>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                {dayNames.map((day, i) => {
                  const rule = availability.rules.find((r) => r.day_of_week === i);
                  const isActive = rule?.is_active ?? false;
                  return (
                    <div key={i} className="rounded-xl border border-border/70 p-4 flex flex-col gap-4" data-testid={`day-${i}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-semibold ${isActive ? "" : "text-muted-foreground"}`}>{day}</span>
                        <Switch checked={isActive} onCheckedChange={() => toggleDay(i)} data-testid={`toggle-day-${i}`} />
                      </div>
                      {isActive && rule ? (
                        <div className="flex items-center gap-2">
                          <Input type="time" value={rule.start_time} onChange={(e) => updateRuleTime(i, "start_time", e.target.value)} className="w-28" data-testid={`start-time-${i}`} />
                          <span className="text-xs text-muted-foreground">ate</span>
                          <Input type="time" value={rule.end_time} onChange={(e) => updateRuleTime(i, "end_time", e.target.value)} className="w-28" data-testid={`end-time-${i}`} />
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Sem atendimento</p>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Public Page Tab */}
        <TabsContent value="public-page">
          <div className="space-y-6">
            <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle className="font-heading text-lg">Link publico</CardTitle>
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
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-border/70 p-4">
                      <p className="text-xs text-muted-foreground">Antecedencia</p>
                      <p className="text-lg font-semibold mt-2">{profile.min_advance_hours}h</p>
                      <p className="text-xs text-muted-foreground mt-1">Para novos agendamentos</p>
                    </div>
                    <div className="rounded-xl border border-border/70 p-4">
                      <p className="text-xs text-muted-foreground">Cancelamento</p>
                      <p className="text-lg font-semibold mt-2">{profile.cancellation_policy_hours}h</p>
                      <p className="text-xs text-muted-foreground mt-1">Prazo limite</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle className="font-heading text-lg">Preview rapido</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="h-24 bg-gradient-to-br from-teal-50 to-stone-100 relative">
                      {profile.cover_picture && (
                        <img src={profile.cover_picture} alt="Foto de capa" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="p-4 flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                        {profile.picture ? (
                          <img src={profile.picture} alt="Foto de perfil" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs text-muted-foreground">Foto</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{profile.business_name || profile.name || "Seu negocio"}</p>
                        <p className="text-xs text-muted-foreground truncate">{profile.city || "Cidade"} · {profile.state || "UF"}</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Atualize imagens e textos para deixar a pagina mais atrativa.
                  </p>
                </CardContent>
              </Card>
            </div>
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="font-heading text-lg">Identidade visual</CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label>Foto de perfil</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                      {profile.picture ? (
                        <img src={profile.picture} alt="Foto de perfil" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem foto</span>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Input type="file" accept="image/*" onChange={(e) => handleImageUpload("picture", e.target.files?.[0])} disabled={uploading.picture} />
                      {profile.picture && (
                        <Button variant="outline" size="sm" onClick={() => setProfile((p) => ({ ...p, picture: "" }))}>
                          Remover
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>Foto de capa</Label>
                  <div className="space-y-2">
                    <div className="h-28 w-full rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                      {profile.cover_picture ? (
                        <img src={profile.cover_picture} alt="Foto de capa" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem capa</span>
                      )}
                    </div>
                    <Input type="file" accept="image/*" onChange={(e) => handleImageUpload("cover_picture", e.target.files?.[0])} disabled={uploading.cover_picture} />
                    {profile.cover_picture && (
                      <Button variant="outline" size="sm" onClick={() => setProfile((p) => ({ ...p, cover_picture: "" }))}>
                        Remover
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="font-heading text-lg">Links sociais</CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Instagram</Label>
                  <Input value={profile.social_links?.instagram || ""} onChange={(e) => updateSocialLink("instagram", e.target.value)} placeholder="instagram.com/seuusuario" />
                </div>
                <div className="space-y-2">
                  <Label>Facebook</Label>
                  <Input value={profile.social_links?.facebook || ""} onChange={(e) => updateSocialLink("facebook", e.target.value)} placeholder="facebook.com/suapagina" />
                </div>
                <div className="space-y-2">
                  <Label>TikTok</Label>
                  <Input value={profile.social_links?.tiktok || ""} onChange={(e) => updateSocialLink("tiktok", e.target.value)} placeholder="tiktok.com/@seuusuario" />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input value={profile.social_links?.whatsapp || ""} onChange={(e) => updateSocialLink("whatsapp", e.target.value)} placeholder="+55 11 99999-9999" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Site</Label>
                  <Input value={profile.social_links?.website || ""} onChange={(e) => updateSocialLink("website", e.target.value)} placeholder="https://seusite.com" />
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-soft">
              <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <CardTitle className="font-heading text-lg">Servicos em destaque</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Aparecem primeiro na pagina publica</p>
                </div>
                <Button onClick={saveProfile} disabled={saving} data-testid="save-slug-btn" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </CardHeader>
              <CardContent>
                {servicesLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando servicos...</p>
                ) : services.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Cadastre servicos para destacar na pagina publica.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {services.map((svc) => {
                      const isFeatured = (profile.featured_service_ids || []).includes(svc.service_id);
                      return (
                        <Button
                          key={svc.service_id}
                          variant="outline"
                          size="sm"
                          onClick={() => toggleFeaturedService(svc.service_id)}
                          className={isFeatured ? "border-primary/50 text-primary bg-primary/10" : ""}
                        >
                          {svc.name}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
