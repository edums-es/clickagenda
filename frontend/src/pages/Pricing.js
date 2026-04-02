import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, Minus } from "lucide-react";

const plans = [
  {
    name: "Iniciante",
    title: "Grátis",
    price: { monthly: 0, annual: 0 },
    desc: "Para quem está começando agora.",
    button: "Começar Agora",
    features: [
      "Link de agendamento único",
      "Até 50 agendamentos/mês",
      "Google Calendar",
      { text: "Lembretes WhatsApp", excluded: true }
    ]
  },
  {
    name: "Profissional",
    title: "Pro",
    price: { monthly: 49, annual: 39 },
    desc: "Tudo do Grátis, mais:",
    button: "Começar Agora",
    features: [
      "Links ilimitados",
      "Agendamentos ilimitados",
      "Lembretes via WhatsApp",
      "Remoção da marca SaaS",
      "Integração com Outlook"
    ],
    popular: true
  },
  {
    name: "Corporativo",
    title: "Business",
    price: { monthly: 99, annual: 79 },
    desc: "Para times e escala:",
    button: "Falar com Vendas",
    features: [
      "Múltiplos membros (até 10)",
      "API de integração completa",
      "Relatórios avançados",
      "Suporte prioritário 24/7"
    ]
  }
];

const comparison = [
  { resource: "Agendamentos mensais", gratis: "50", pro: "Ilimitado", business: "Ilimitado" },
  { resource: "Páginas de reserva", gratis: "1", pro: "Ilimitado", business: "Ilimitado" },
  { resource: "Notificações WhatsApp", gratis: null, pro: true, business: true },
  { resource: "Pagamentos integrados", gratis: null, pro: true, business: true },
  { resource: "Customização CSS", gratis: null, pro: null, business: true },
  { resource: "API Access", gratis: null, pro: null, business: "Full SDK" }
];

export default function Pricing() {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Header sections from Landing (Navbar) should be here if layout is used, but assuming standalone component for now as per file structure */}
      
      <div className="max-w-7xl mx-auto px-4 pt-32 pb-20 text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-heading text-gray-900 tracking-tight leading-tight">
          Escolha o plano ideal para o seu negócio
        </h1>
        <p className="mt-6 text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
          Gerencie seus agendamentos de forma profissional e eficiente. Escalone sua agenda sem complicações técnicas.
        </p>

        {/* Toggle */}
        <div className="mt-12 flex items-center justify-center gap-4">
          <div className="bg-gray-50 p-1 rounded-full flex border border-gray-100 shadow-sm relative">
            <button 
              onClick={() => setIsAnnual(false)}
              className={`px-8 py-2.5 rounded-full text-sm font-bold transition-all relative z-10 ${!isAnnual ? 'bg-white shadow-md text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Mensal
            </button>
            <button 
              onClick={() => setIsAnnual(true)}
              className={`px-8 py-2.5 rounded-full text-sm font-bold transition-all relative z-10 flex items-center gap-2 ${isAnnual ? 'bg-white shadow-md text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Anual
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black">-20%</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="max-w-7xl mx-auto px-4 pb-24">
        <div className="grid lg:grid-cols-3 gap-8 items-stretch pt-4">
          {plans.map((plan, idx) => (
            <div 
              key={idx} 
              className={`relative flex flex-col p-8 rounded-[2.5rem] border transition-all duration-500 hover:-translate-y-2 ${plan.popular ? 'border-primary shadow-[0_20px_50px_rgba(20,184,166,0.15)] ring-4 ring-primary/5' : 'border-gray-100 bg-white shadow-sm hover:shadow-xl'}`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-white text-[10px] font-black tracking-[0.2em] uppercase px-6 py-2 rounded-full shadow-lg whitespace-nowrap">
                  MAIS POPULAR
                </div>
              )}

              <div className="mb-8">
                <span className={`text-[10px] font-black tracking-widest uppercase mb-2 block ${plan.popular ? 'text-primary' : 'text-gray-400'}`}>
                  {plan.name}
                </span>
                <h3 className="text-3xl font-bold font-heading text-gray-900 mb-6">{plan.title}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black text-gray-900">R$ {isAnnual ? plan.price.annual : plan.price.monthly}</span>
                  <span className="text-sm font-semibold text-gray-400">/mês</span>
                </div>
              </div>

              <Link to="/register" className="mb-10">
                <Button className={`w-full py-7 h-auto rounded-2xl text-lg font-bold transition-all active:scale-95 ${plan.popular ? 'bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20' : plan.title === 'Business' ? 'bg-gray-900 hover:bg-gray-800 text-white shadow-xl shadow-gray-900/20' : 'bg-gray-100 hover:bg-gray-200 text-gray-900 shadow-sm'}`}>
                  {plan.button}
                </Button>
              </Link>

              <div className="flex flex-col gap-5 flex-1">
                <p className="text-sm font-bold text-gray-900">{plan.desc}</p>
                <ul className="space-y-4">
                  {plan.features.map((feat, fIdx) => (
                    <li key={fIdx} className={`flex items-center gap-3 text-sm font-medium ${typeof feat === 'object' && feat.excluded ? 'text-gray-300' : 'text-gray-600'}`}>
                      {typeof feat === 'object' && feat.excluded ? (
                        <div className="w-5 h-5 flex items-center justify-center text-gray-200">
                          <Minus className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                          <Check className="w-3 h-3 stroke-[4px]" />
                        </div>
                      )}
                      {typeof feat === 'object' ? feat.text : feat}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Comparison Table */}
      <div className="max-w-5xl mx-auto px-4 pb-24">
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden">
          <div className="p-8 border-b border-gray-50">
            <h2 className="text-2xl font-bold font-heading text-gray-900">Comparação detalhada</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] font-black tracking-widest text-gray-400 uppercase">
                  <th className="px-8 py-4">Recurso</th>
                  <th className="px-8 py-4">Grátis</th>
                  <th className="px-8 py-4 text-primary">Pro</th>
                  <th className="px-8 py-4">Business</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {comparison.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-8 py-5 text-sm font-bold text-gray-600">{item.resource}</td>
                    <td className="px-8 py-5 text-sm font-medium text-gray-400">
                      {item.gratis === true ? <Check className="w-4 h-4 text-primary" /> : item.gratis === null ? <div className="w-4 h-0.5 bg-gray-100" /> : item.gratis}
                    </td>
                    <td className="px-8 py-5 text-sm font-bold text-primary">
                      {item.pro === true ? <Check className="w-5 h-5" /> : item.pro === null ? <div className="w-4 h-0.5 bg-gray-100" /> : item.pro}
                    </td>
                    <td className="px-8 py-5 text-sm font-medium text-gray-600">
                      {item.business === true ? <Check className="w-4 h-4 text-primary" /> : item.business === null ? <div className="w-4 h-0.5 bg-gray-100" /> : item.business}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Social Proof */}
      <div className="max-w-7xl mx-auto px-4 pb-32">
        <div className="text-center mb-10">
          <p className="text-[10px] font-black tracking-[0.3em] text-gray-400 uppercase">
            Utilizado por mais de 5.000 profissionais no Brasil
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-6 opacity-30 grayscale contrast-125">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="px-8 py-3 bg-gray-200/50 rounded-lg text-[10px] font-black tracking-widest text-gray-400">
               LOGO {i}
            </div>
          ))}
        </div>
      </div>

      {/* Final CTA */}
      <div className="max-w-6xl mx-auto px-4 pb-20">
        <div className="bg-gray-900 rounded-[3rem] px-8 py-20 relative overflow-hidden group">
          <div className="absolute inset-0 bg-dot-pattern opacity-5" />
          <div className="relative text-center flex flex-col items-center">
            <h2 className="text-4xl md:text-5xl font-bold font-heading text-white tracking-tight mb-6 max-w-xl leading-tight">
              Pronto para transformar seu agendamento?
            </h2>
            <p className="text-white/60 text-lg mb-12 max-w-lg font-medium leading-relaxed">
              Junte-se a milhares de profissionais que economizam até 10 horas semanais com nossa plataforma.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link to="/register">
                <Button className="bg-primary hover:bg-primary/90 text-white rounded-full px-10 py-6 h-auto text-lg font-bold shadow-2xl shadow-primary/30 transition-all hover:scale-105 active:scale-95">
                  Começar Grátis Agora
                </Button>
              </Link>
              <Button variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-full px-10 py-6 h-auto text-lg font-bold backdrop-blur-sm shadow-xl transition-all hover:scale-105 active:scale-95">
                Ver Demonstração
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer from Landing would typically be global, but for standalone pages: */}
      <footer className="py-20 border-t border-gray-50">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-start justify-between gap-12">
           <div className="space-y-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white shadow-lg shadow-primary/20">
                  <Badge className="bg-transparent p-0"><Check className="w-5 h-5 stroke-[4px]" /></Badge>
                </div>
                <span className="text-2xl font-bold text-gray-900 font-heading">SalãoZap</span>
              </div>
              <p className="text-gray-400 text-sm max-w-[280px] leading-relaxed">
                A solução completa para gestão de agendamentos no mercado brasileiro.
              </p>
           </div>
           
           <div className="grid grid-cols-2 sm:grid-cols-3 gap-12 sm:gap-24">
              {[
                { title: "Produto", links: ["Recursos", "Integrações", "Atualizações"] },
                { title: "Suporte", links: ["Central de Ajuda", "Comunidade", "Contato"] },
                { title: "Jurídico", links: ["Privacidade", "Termos de Uso", "LGPD"] }
              ].map((col, idx) => (
                <div key={idx}>
                  <h6 className="text-[10px] font-black text-gray-900 tracking-widest uppercase mb-6">{col.title}</h6>
                  <ul className="space-y-4">
                    {col.links.map((link, lIdx) => (
                      <li key={lIdx}>
                        <a href="#" className="text-gray-500 hover:text-primary transition-colors text-xs font-semibold">{link}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
           </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pt-16 text-center">
            <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">
              © 2024 SalãoZap. Feito com ❤️ para profissionais brasileiros.
            </p>
        </div>
      </footer>
    </div>
  );
}
