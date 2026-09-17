import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, CalendarDays, Sparkles } from "lucide-react";

const plans = [
  {
    name: "Freemium",
    price: "Grátis",
    description: "Para começar a atender online sem compromisso.",
    action: "Criar conta grátis",
    features: ["1 agenda profissional", "Página pública de agendamento", "Cadastro de serviços e clientes", "Até 30 agendamentos por mês"],
  },
  {
    name: "Pro",
    price: "69,90",
    description: "Para quem já depende da agenda todos os dias.",
    action: "Assinar o Pro",
    featured: true,
    features: ["Tudo do Freemium", "Agendamentos sem limite", "Página pública personalizada", "Cobrança mensal transparente"],
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-[#f7fbfa] text-slate-900">
      <header className="max-w-6xl mx-auto px-5 py-7 flex items-center justify-between">
        <Link to="/" className="font-heading font-black text-xl tracking-tight">ClickAgenda</Link>
        <Link to="/login" className="text-sm font-bold text-slate-600 hover:text-primary">Entrar</Link>
      </header>

      <main className="max-w-5xl mx-auto px-5 pt-14 pb-24">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider">
            <Sparkles className="h-4 w-4" /> Simples e direto
          </div>
          <h1 className="mt-6 text-4xl md:text-5xl font-black font-heading tracking-tight">Uma agenda que cresce com você.</h1>
          <p className="mt-5 text-lg text-slate-600 leading-relaxed">Comece grátis. Quando precisar de mais horários, o Pro custa apenas R$ 69,90 por mês.</p>
        </div>

        <section className="grid md:grid-cols-2 gap-7 max-w-4xl mx-auto mt-14">
          {plans.map((plan) => (
            <article key={plan.name} className={`relative rounded-[2rem] p-8 md:p-10 border ${plan.featured ? "bg-slate-950 border-slate-950 text-white shadow-2xl shadow-slate-900/20" : "bg-white border-slate-100 shadow-xl shadow-slate-900/5"}`}>
              {plan.featured && <span className="absolute -top-3 left-8 rounded-full bg-primary px-4 py-1.5 text-[10px] font-black tracking-widest uppercase text-white">Plano completo</span>}
              <div className="flex items-center justify-between">
                <span className={`text-sm font-black uppercase tracking-[.18em] ${plan.featured ? "text-primary" : "text-slate-400"}`}>{plan.name}</span>
                <CalendarDays className={plan.featured ? "text-primary" : "text-slate-300"} />
              </div>
              <div className="mt-8 flex items-end gap-2">
                {plan.price === "Grátis" ? <strong className="text-4xl font-black">Grátis</strong> : <><span className="text-lg font-bold">R$</span><strong className="text-5xl font-black">{plan.price}</strong><span className={plan.featured ? "text-slate-400 mb-2" : "text-slate-500 mb-2"}>/mês</span></>}
              </div>
              <p className={`mt-5 min-h-12 ${plan.featured ? "text-slate-300" : "text-slate-600"}`}>{plan.description}</p>
              <Link to="/register" className="block mt-8">
                <Button className={`w-full h-13 rounded-xl font-black ${plan.featured ? "bg-primary hover:bg-primary/90 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-900"}`}>{plan.action}<ArrowRight className="ml-2 h-4 w-4" /></Button>
              </Link>
              <ul className="mt-9 space-y-4">
                {plan.features.map((feature) => <li key={feature} className={`flex items-start gap-3 text-sm font-medium ${plan.featured ? "text-slate-200" : "text-slate-600"}`}><span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-primary/15 text-primary"><Check className="h-3.5 w-3.5 stroke-[3px]" /></span>{feature}</li>)}
              </ul>
            </article>
          ))}
        </section>

        <p className="mt-10 text-center text-sm text-slate-500">Sem plano Business, sem tabela confusa e sem funcionalidades prometidas que não existem.</p>
      </main>
    </div>
  );
}
