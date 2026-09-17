import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { BarChart3, Users, CalendarDays, CircleDollarSign, ShieldCheck } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

export default function SuperAdmin() {
  const [overview, setOverview] = useState(null);
  const [professionals, setProfessionals] = useState([]);
  const [pixel, setPixel] = useState("");
  const [loading, setLoading] = useState(true);
  const load = async () => {
    try {
      const [stats, users, settings] = await Promise.all([api.get("/admin/overview"), api.get("/admin/professionals"), api.get("/admin/settings/pixel")]);
      setOverview(stats.data); setProfessionals(users.data); setPixel(settings.data.pixel_id || "");
    } catch { toast.error("Você não tem acesso ao painel superadmin."); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const changePlan = async (id, plan) => { try { await api.put(`/admin/professionals/${id}/plan`, { plan, status: "active" }); toast.success("Plano atualizado."); load(); } catch { toast.error("Não foi possível atualizar o plano."); } };
  const savePixel = async () => { try { await api.put("/admin/settings/pixel", { pixel_id: pixel }); toast.success("Pixel salvo."); } catch (error) { toast.error(error.response?.data?.detail || "Pixel inválido."); } };
  if (loading) return <div className="p-8">Carregando administração...</div>;
  const cards = [["Profissionais", overview?.professionals, Users], ["Novos no mês", overview?.new_professionals_month, BarChart3], ["Reservas no mês", overview?.bookings_month, CalendarDays], ["Receita confirmada", money(overview?.revenue_month), CircleDollarSign]];
  return <div className="space-y-7"><div><p className="text-xs font-black uppercase tracking-widest text-primary">Controle da plataforma</p><h1 className="text-3xl font-black font-heading">Superadmin</h1></div><div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">{cards.map(([label, value, Icon]) => <div key={label} className="bg-white rounded-2xl border p-5"><Icon className="h-5 w-5 text-primary"/><p className="mt-5 text-2xl font-black">{value || 0}</p><p className="text-sm text-muted-foreground">{label}</p></div>)}</div><div className="grid lg:grid-cols-2 gap-6"><section className="rounded-3xl border bg-white p-6 h-80"><h2 className="font-black">Crescimento de profissionais</h2><ResponsiveContainer width="100%" height="90%"><AreaChart data={overview?.trend || []}><defs><linearGradient id="growth" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#00D49D" stopOpacity=".35"/><stop offset="1" stopColor="#00D49D" stopOpacity="0"/></linearGradient></defs><XAxis dataKey="month" fontSize={11}/><YAxis fontSize={11}/><Tooltip/><Area type="monotone" dataKey="professionals" stroke="#00B986" fill="url(#growth)" strokeWidth={3}/></AreaChart></ResponsiveContainer></section><section className="rounded-3xl border bg-white p-6 h-80"><h2 className="font-black">Reservas mensais</h2><ResponsiveContainer width="100%" height="90%"><BarChart data={overview?.trend || []}><XAxis dataKey="month" fontSize={11}/><YAxis fontSize={11}/><Tooltip/><Bar dataKey="bookings" fill="#0f172a" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></section></div><section className="rounded-3xl border bg-white p-6"><div className="flex items-center gap-2"><ShieldCheck className="text-primary h-5 w-5"/><h2 className="font-black">Pixel Meta Ads</h2></div><p className="mt-2 text-sm text-muted-foreground">Mede visualização de página, início de reserva e reserva confirmada nas páginas públicas.</p><div className="flex gap-3 mt-4 max-w-md"><Input value={pixel} onChange={(e) => setPixel(e.target.value)} placeholder="ID numérico do Pixel"/><Button onClick={savePixel}>Salvar</Button></div></section><section className="rounded-3xl border bg-white overflow-hidden"><div className="p-6 border-b"><h2 className="font-black">Profissionais</h2><p className="text-sm text-muted-foreground mt-1">{overview?.pro_accounts || 0} Pro · {overview?.freemium_accounts || 0} Freemium</p></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-4">Negócio</th><th className="p-4">Link</th><th className="p-4">Plano</th><th className="p-4">Ação</th></tr></thead><tbody>{professionals.map((user) => <tr key={user.id} className="border-t"><td className="p-4 font-bold">{user.business_name || user.full_name}</td><td className="p-4 text-slate-500">/{user.slug}</td><td className="p-4 capitalize">{user.plan}</td><td className="p-4"><Button size="sm" variant="outline" onClick={() => changePlan(user.id, user.plan === "pro" ? "freemium" : "pro")}>{user.plan === "pro" ? "Voltar ao Free" : "Liberar Pro"}</Button></td></tr>)}</tbody></table></div></section></div>;
}
