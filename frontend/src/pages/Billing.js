import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { BadgeCheck, Copy, CreditCard, QrCode, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Billing() {
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState("");
  const [pix, setPix] = useState(null);

  const load = async () => {
    try { setBilling((await api.get("/billing/me")).data); } catch { toast.error("Não foi possível consultar seu plano."); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const checkout = async (provider) => {
    setStarting(provider);
    try {
      const { data } = await api.post("/billing/checkout", { provider });
      if (data.checkout_url) window.location.assign(data.checkout_url);
      else if (provider === "woovi") setPix(data);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Não foi possível iniciar o pagamento.");
    } finally { setStarting(""); }
  };
  const openPortal = async () => {
    try { window.location.assign((await api.post("/billing/portal")).data.url); }
    catch (error) { toast.error(error.response?.data?.detail || "Este meio de pagamento não possui portal de autoatendimento."); }
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Carregando plano...</div>;
  const isPro = billing?.plan === "pro";
  return (
    <div className="max-w-3xl mx-auto py-4 space-y-6">
      <div><p className="text-xs font-black uppercase tracking-widest text-primary">Assinatura</p><h1 className="text-3xl font-black font-heading mt-1">Seu plano ClickAgenda</h1></div>
      <section className={`rounded-3xl p-7 ${isPro ? "bg-slate-950 text-white" : "bg-primary/10"}`}>
        <div className="flex items-start justify-between gap-5"><div><h2 className="text-2xl font-black">{isPro ? "Pro ativo" : "Freemium"}</h2><p className={isPro ? "text-slate-300 mt-2" : "text-slate-600 mt-2"}>{isPro ? "Você tem agendamentos sem limite." : `${billing?.booking_count || 0} de 30 agendamentos usados neste mês.`}</p></div><BadgeCheck className={isPro ? "text-primary" : "text-primary"} /></div>
      </section>
      {!isPro && <section className="rounded-3xl border bg-white p-7"><h2 className="text-xl font-black">Ative o Pro por R$ 69,90/mês</h2><p className="text-sm text-muted-foreground mt-2">Escolha o meio de pagamento. Dados de cartão nunca passam pelo ClickAgenda.</p><div className="grid sm:grid-cols-3 gap-3 mt-6"><Button onClick={() => checkout("stripe")} disabled={!!starting} className="h-12 bg-slate-900 hover:bg-slate-800"><CreditCard className="mr-2 h-4 w-4" />{starting === "stripe" ? <Loader2 className="animate-spin h-4 w-4" /> : "Cartão (Stripe)"}</Button><Button onClick={() => checkout("woovi")} disabled={!!starting} variant="outline" className="h-12"><QrCode className="mr-2 h-4 w-4" />{starting === "woovi" ? <Loader2 className="animate-spin h-4 w-4" /> : "Pix (Woovi)"}</Button><Button onClick={() => checkout("stone")} disabled={!!starting} variant="outline" className="h-12">Stone</Button></div></section>}
      {isPro && billing?.subscription?.provider === "stripe" && <Button variant="outline" onClick={openPortal}>Gerenciar assinatura Stripe</Button>}
      {pix && <section className="rounded-3xl border border-primary/30 bg-primary/5 p-7"><h2 className="font-black text-lg">Pix gerado</h2><p className="text-sm text-muted-foreground mt-1">Após a confirmação da Woovi, seu plano será ativado.</p>{pix.qr_code_image && <img src={pix.qr_code_image} alt="QR Code Pix" className="w-44 h-44 mt-5 rounded-xl bg-white p-2" />}{pix.br_code && <Button variant="outline" className="mt-4" onClick={() => { navigator.clipboard.writeText(pix.br_code); toast.success("Código Pix copiado."); }}><Copy className="mr-2 h-4 w-4" />Copiar Pix copia e cola</Button>}</section>}
      <Link to="/dashboard" className="text-sm font-bold text-primary">Voltar ao painel</Link>
    </div>
  );
}
