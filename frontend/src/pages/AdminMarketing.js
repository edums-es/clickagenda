import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart3, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminMarketing() {
  const [pixel, setPixel] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get("/admin/settings/pixel").then((res) => setPixel(res.data.pixel_id || "")).catch(() => {}); }, []);
  const save = async () => { setSaving(true); try { await api.put("/admin/settings/pixel", { pixel_id: pixel }); toast.success("Pixel Meta salvo."); } catch (error) { toast.error(error.response?.data?.detail || "A migração comercial ainda precisa ser aplicada no Supabase."); } finally { setSaving(false); } };
  return <div className="max-w-3xl mx-auto space-y-7"><div><p className="text-xs font-black uppercase tracking-widest text-primary">Aquisição</p><h1 className="text-3xl font-black font-heading">Marketing e Pixel Meta</h1><p className="mt-2 text-muted-foreground">Mede PageView, ViewContent, início de reserva e reserva confirmada nas páginas públicas.</p></div><section className="rounded-3xl border bg-white p-7"><div className="flex gap-4"><div className="h-11 w-11 rounded-2xl bg-primary/10 grid place-items-center text-primary"><BarChart3 className="h-5 w-5" /></div><div><h2 className="font-black text-lg">Pixel Meta Ads</h2><p className="text-sm text-muted-foreground mt-1">Informe apenas o ID numérico público do Pixel, nunca um token de acesso.</p></div></div><div className="mt-6 flex flex-col sm:flex-row gap-3"><Input value={pixel} onChange={(event) => setPixel(event.target.value)} inputMode="numeric" placeholder="Ex.: 123456789012345"/><Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar Pixel"}</Button></div>{pixel && <p className="mt-4 flex items-center gap-2 text-sm text-primary"><CheckCircle2 className="h-4 w-4" />Pixel configurado para as novas visitas públicas.</p>}</section></div>;
}
