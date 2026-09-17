import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  Check,
  ArrowRight,
  Zap,
  Users,
  Clock,
  Smartphone,
  Calendar,
  Star,
  ShieldCheck,
  ArrowUpRight,
  Layout,
  MousePointer2,
  Bell,
  Menu,
  X
} from "lucide-react";

export default function Landing() {
  const { user, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-white font-body selection:bg-primary/20">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16 sm:h-20">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="text-xl sm:text-2xl font-bold font-heading text-gray-900 tracking-tight">SalãoZap</span>
          </div>

          <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#funcionalidades" className="hover:text-primary transition-colors">Funcionalidades</a>
            <a href="#como-funciona" className="hover:text-primary transition-colors">Como funciona</a>
            <a href="#precos" className="hover:text-primary transition-colors">Preços</a>
            <a href="#depoimentos" className="hover:text-primary transition-colors">Depoimentos</a>
          </nav>

          <div className="hidden sm:flex items-center gap-4">
            <Link to="/login" className="text-sm font-semibold text-gray-700 hover:text-primary transition-colors">Entrar</Link>
            <Link to="/register">
              <Button className="bg-primary hover:bg-primary/90 text-white rounded-full px-6 py-5 h-auto text-sm font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">
                Criar meu link
              </Button>
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="sm:hidden grid h-11 w-11 place-items-center rounded-xl border border-gray-100 bg-white text-gray-900 shadow-sm active:scale-95"
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileMenuOpen && <nav className="lg:hidden border-t border-gray-100 bg-white px-4 pb-4 pt-3 shadow-xl animate-slide-up">
          <div className="mx-auto grid max-w-7xl gap-1">
            {[["Funcionalidades", "#funcionalidades"], ["Como funciona", "#como-funciona"], ["Preços", "#precos"], ["Depoimentos", "#depoimentos"]].map(([label, href]) => (
              <a key={href} href={href} onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-bold text-gray-700 active:bg-primary/10">{label}</a>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Link to="/login" className="rounded-xl border border-gray-200 py-3 text-center text-sm font-bold text-gray-800">Entrar</Link>
              <Link to="/register" className="rounded-xl bg-primary py-3 text-center text-sm font-bold text-white shadow-lg shadow-primary/20">Criar link</Link>
            </div>
          </div>
        </nav>}
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-14 sm:pt-32 sm:pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Abstract shapes for background */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-10 sm:gap-16 items-center">
            <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-primary/5 text-primary text-[11px] sm:text-sm font-bold mb-6 sm:mb-8 border border-primary/10 tracking-wide uppercase">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Lançamento Oficial Brasil
              </div>
              
              <h1 className="text-[2.65rem] sm:text-6xl lg:text-7xl font-bold font-heading text-gray-900 leading-[1.05] tracking-tight">
                Sua agenda no <br />
                <span className="text-primary italic">automático</span>
              </h1>
              
              <p className="mt-6 sm:mt-8 text-base sm:text-lg text-gray-600 max-w-xl leading-relaxed">
                Crie seu link de agendamento profissional em minutos e deixe sua agenda organizada, sem troca de mensagens para encontrar horários.
              </p>
              
              <div className="mt-8 sm:mt-10 flex w-full flex-col sm:w-auto sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <Link to="/register" className="w-full sm:w-auto">
                  <Button className="w-full bg-primary hover:bg-primary/90 text-white rounded-2xl sm:rounded-full px-8 sm:px-10 py-5 sm:py-6 h-auto text-base sm:text-lg font-bold shadow-xl shadow-primary/30 transition-all active:scale-[0.98] sm:hover:scale-105">
                    Começar grátis agora
                  </Button>
                </Link>
                <a href="#como-funciona" className="flex items-center justify-center gap-2 rounded-2xl sm:rounded-full text-gray-600 hover:text-primary font-bold px-6 py-3.5 sm:py-4 transition-colors active:bg-primary/5">
                  <div className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center group-hover:border-primary transition-colors">
                    <ArrowRight className="w-5 h-5 ml-0.5" />
                  </div>
                  Ver como funciona
                </a>
              </div>

              <div className="mt-8 sm:mt-12 inline-flex items-center gap-2.5 rounded-full bg-gray-50 px-4 py-2.5 text-left">
                <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                <p className="text-xs sm:text-sm text-gray-600 font-medium">Seu link, sua agenda, seu ritmo.</p>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-primary/20 rounded-[2.5rem] blur-2xl group-hover:blur-3xl transition-all duration-500" />
              <div className="relative bg-white rounded-[2rem] border border-gray-100 shadow-2xl overflow-hidden glow-mint transform lg:rotate-2 hover:rotate-0 transition-transform duration-700">
                {/* Mockup Top Bar */}
                <div className="h-8 bg-gray-50 border-b border-gray-100 flex items-center px-4 gap-1.5 leading-none">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  <div className="ml-4 flex-1 h-4 bg-gray-200/50 rounded-full text-[8px] flex items-center px-2 text-gray-400">
                    clickagenda.com/seu-agendamento
                  </div>
                </div>
                <div className="p-5 sm:p-8 space-y-5 sm:space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="space-y-2 flex-1">
                      <div className="h-2 w-32 bg-gray-100 rounded-full" />
                      <div className="h-2 w-48 bg-gray-50 rounded-full" />
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {[16, 17, 18, 19, 20, 21, 22].map((d) => (
                      <div key={d} className={`aspect-square rounded-xl flex flex-col items-center justify-center text-xs font-bold border transition-colors ${d === 18 ? 'bg-primary text-white border-primary border-4 shadow-lg shadow-primary/20' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 w-full bg-gray-50 rounded-lg" />
                    <div className="h-4 w-5/6 bg-gray-50 rounded-lg" />
                    <div className="h-4 w-4/6 bg-gray-50 rounded-lg" />
                  </div>
                  <div className="flex justify-end pt-4">
                    <div className="h-10 w-32 bg-primary rounded-full shadow-lg shadow-primary/20" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="como-funciona" className="py-16 sm:py-24 bg-gray-50/50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-20">
            <span className="text-primary font-bold text-sm tracking-widest uppercase mb-4 block">Como funciona</span>
            <h2 className="text-3xl sm:text-5xl font-bold font-heading text-gray-900 tracking-tight">
              Professionalize seu atendimento em 3 passos
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-10 sm:gap-12 lg:gap-20">
            {[
              {
                icon: Layout,
                title: "1. Crie seu perfil",
                desc: "Defina seus serviços, duração e horários disponíveis de forma personalizada."
              },
              {
                icon: Smartphone,
                title: "2. Compartilhe o link",
                desc: "Coloque seu link exclusivo na bio do Instagram, no Google ou onde seus clientes encontrarem você."
              },
              {
                icon: ShieldCheck,
                title: "3. Receba agendamentos",
                desc: "Seus clientes agendam sozinhos e você recebe notificações instantâneas."
              }
            ].map((step, idx) => (
              <div key={idx} className="flex flex-col items-center text-center group">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-3xl shadow-xl shadow-gray-200/50 flex items-center justify-center mb-5 sm:mb-8 border border-gray-100 transform transition-all sm:group-hover:-translate-y-2 group-hover:bg-primary/5">
                  <step.icon className="w-8 h-8 sm:w-10 sm:h-10 text-primary transition-colors" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4 font-heading">{step.title}</h3>
                <p className="text-gray-500 leading-relaxed text-base sm:text-lg px-4">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="funcionalidades" className="py-16 sm:py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-6 order-2 lg:order-1">
              {[
                { icon: CalendarDays, title: "Agenda online", desc: "Horários disponíveis atualizados em tempo real." },
                { icon: Calendar, title: "Organização", desc: "Serviços, duração e intervalos no mesmo lugar." },
                { icon: Users, title: "Clientes", desc: "Histórico e dados de atendimento sempre à mão." },
                { icon: MousePointer2, title: "Link público", desc: "Uma página simples para seus clientes agendarem." }
              ].map((feat, idx) => (
                <div key={idx} className={`p-4 sm:p-6 rounded-3xl border border-gray-100 shadow-sm transition-all sm:hover:shadow-xl sm:hover:border-transparent ${idx % 2 === 1 ? 'lg:translate-y-8' : ''} bg-white`}>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/5 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 text-primary border border-primary/10">
                    <feat.icon className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-2 font-heading">{feat.title}</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">{feat.desc}</p>
                </div>
              ))}
            </div>

            <div className="order-1 lg:order-2">
              <h2 className="text-3xl sm:text-5xl font-bold font-heading text-gray-900 leading-tight mb-6 sm:mb-8">
                Tudo que você precisa para <span className="text-primary">crescer</span> seu negócio
              </h2>
              <p className="text-base sm:text-lg text-gray-600 mb-7 sm:mb-10 leading-relaxed">
                Focamos na simplicidade para você e para seu cliente. Menos tempo respondendo mensagens, mais tempo faturando.
              </p>
              <ul className="space-y-5">
                {[
                  "Sem aplicativos para instalar",
                  "Suporte humanizado em português",
                  "Cancelamentos automáticos com regras"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-base sm:text-lg font-bold text-gray-700">
                    <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white">
                      <Check className="w-4 h-4 stroke-[3px]" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="depoimentos" className="py-16 sm:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-20">
            <h2 className="text-3xl sm:text-4xl font-bold font-heading text-gray-900">Quem usa, recomenda</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5 sm:gap-8">
            {[
              {
                text: "\"O SalãoZap mudou minha rotina. Meus pacientes marcam sozinhos e eu não preciso parar meus atendimentos.\"",
                author: "Mariana Silva",
                role: "Dentista",
                img: "https://i.pravatar.cc/100?img=32"
              },
              {
                text: "\"Interface limpa e muito intuitiva. O suporte em português é um grande diferencial para nós aqui no Brasil. Meus clientes elogiam!\"",
                author: "Dr. Ricardo Santos",
                role: "Fisioterapeuta",
                img: "https://i.pravatar.cc/100?img=12"
              },
              {
                text: "\"Melhor custo-benefício que encontrei. O design passa muita credibilidade para meus clientes de consultoria.\"",
                author: "Ana Oliveira",
                role: "Consultora",
                img: "https://i.pravatar.cc/100?img=47"
              }
            ].map((testimonial, idx) => (
              <div key={idx} className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col items-start gap-5 sm:gap-6">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="w-5 h-5 text-primary fill-primary" />
                  ))}
                </div>
                <p className="text-gray-600 leading-relaxed text-lg flex-1 italic">{testimonial.text}</p>
                <div className="flex items-center gap-4 pt-6 border-t border-gray-100 w-full">
                  <img src={testimonial.img} alt={testimonial.author} className="w-12 h-12 rounded-full border-2 border-primary/20" />
                  <div>
                    <h5 className="font-bold text-gray-900">{testimonial.author}</h5>
                    <p className="text-gray-400 text-sm">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Table */}
      <section id="precos" className="py-16 sm:py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-heading text-gray-900 tracking-tight">Dois planos. Sem complicação.</h2>
            <p className="mt-4 text-base sm:text-lg text-gray-600">Comece no Freemium e avance quando sua agenda pedir mais.</p>
          </div>

          <div className="mx-auto grid max-w-4xl md:grid-cols-2 gap-5 sm:gap-8 items-stretch">
            {[
              {
                name: "Freemium",
                price: "Grátis",
                desc: "Tudo para colocar seu link no ar e começar a atender.",
                features: ["Página pública personalizada", "Até 30 agendamentos por mês", "Cadastro de clientes e serviços"],
                action: "Começar grátis"
              },
              {
                name: "Pro",
                price: "69,90",
                period: "/mês",
                desc: "A agenda completa para quem quer crescer sem limite.",
                features: ["Agendamentos ilimitados", "Pagamento por Pix ou cartão", "Prioridade nas novas funcionalidades"],
                popular: true,
                action: "Assinar Pro"
              }
            ].map((plan, idx) => (
              <div key={idx} className={`relative p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border transition-all duration-300 sm:hover:-translate-y-2 ${plan.popular ? 'bg-gray-900 border-gray-900 text-white shadow-2xl sm:scale-105' : 'bg-white border-gray-100 text-gray-900 shadow-sm sm:hover:shadow-xl'}`}>
                {plan.popular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-white text-[10px] font-black tracking-[0.2em] uppercase px-4 py-1.5 rounded-full shadow-lg">
                    MAIS POPULAR
                  </div>
                )}
                <div className="mb-8 text-center">
                  <h4 className="text-xl font-bold mb-2 font-heading">{plan.name}</h4>
                  <div className="flex items-baseline justify-center gap-1">
                    {plan.price !== "Grátis" && <span className="text-lg font-bold">R$</span>}
                    <span className="text-4xl sm:text-5xl font-black">{plan.price}</span>
                    {plan.period && <span className={`text-sm font-medium ${plan.popular ? 'text-gray-400' : 'text-gray-400'}`}>{plan.period}</span>}
                  </div>
                  <p className={`mt-4 text-sm font-medium ${plan.popular ? 'text-gray-400' : 'text-gray-500'}`}>{plan.desc}</p>
                </div>
                <ul className="space-y-4 mb-10">
                  {plan.features.map((feat, fIdx) => (
                    <li key={fIdx} className="flex items-center gap-3 text-sm font-semibold">
                      <Check className={`w-5 h-5 ${plan.popular ? 'text-primary' : 'text-primary'}`} />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link to="/register">
                  <Button className={`w-full rounded-2xl py-6 h-auto text-lg font-bold shadow-lg transition-all active:scale-95 ${plan.popular ? 'bg-primary hover:bg-primary/90 text-white shadow-primary/20' : 'bg-gray-50 hover:bg-gray-100 text-gray-900 shadow-gray-200/50'}`}>
                    {plan.action}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-20 px-4">
        <div className="max-w-6xl mx-auto relative overflow-hidden bg-primary rounded-[2rem] sm:rounded-[3rem] shadow-2xl shadow-primary/40 px-6 py-12 sm:px-20 sm:py-24 group">
          <div className="absolute inset-0 bg-dot-pattern opacity-10" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          
          <div className="relative text-center flex flex-col items-center">
            <h2 className="text-3xl sm:text-5xl font-bold font-heading text-white max-w-2xl leading-tight">
              Pronto para colocar sua agenda no automático?
            </h2>
            <p className="mt-5 sm:mt-6 text-white/80 text-base sm:text-xl max-w-xl">
              Comece com seu link grátis e deixe sua agenda trabalhar por você.
            </p>
            <div className="mt-8 sm:mt-10 flex w-full flex-col sm:w-auto sm:flex-row items-center gap-4 sm:gap-6">
              <Link to="/register" className="w-full sm:w-auto">
                <Button className="w-full bg-white hover:bg-gray-100 text-primary rounded-2xl sm:rounded-full px-8 sm:px-12 py-5 sm:py-6 h-auto text-base sm:text-xl font-bold shadow-xl transition-all active:scale-[0.98] sm:hover:scale-105">
                  Criar meu link agora
                </Button>
              </Link>
              <span className="text-white/70 font-medium text-sm">Sem cartão no Freemium</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12 pb-16">
            <div className="col-span-1 md:col-span-1">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <span className="text-2xl font-bold text-gray-900 font-heading">SalãoZap</span>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed max-w-[240px]">
                Simplificando o agendamento de serviços para o mercado brasileiro desde 2023.
              </p>
            </div>
            
            {[
              {
                title: "PRODUTO",
                links: ["Recursos", "Integrações", "Preços", "Update Log"]
              },
              {
                title: "EMPRESA",
                links: ["Sobre nós", "Carreiras", "Blog", "Contato"]
              },
              {
                title: "LEGAL",
                links: ["Privacidade", "Termos", "Segurança"]
              }
            ].map((col, idx) => (
              <div key={idx}>
                <h6 className="text-[10px] sm:text-xs font-black text-gray-900 tracking-widest uppercase mb-6">{col.title}</h6>
                <ul className="space-y-4">
                  {col.links.map((link, lIdx) => (
                    <li key={lIdx}>
                      <a href="#" className="text-gray-500 hover:text-primary transition-colors text-sm font-medium">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-gray-400 text-[10px] sm:text-xs font-medium">
              © 2024 SalãoZap. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-8 text-[10px] sm:text-xs font-bold text-gray-500 tracking-widest">
              <a href="#" className="hover:text-primary transition-colors">TWITTER</a>
              <a href="#" className="hover:text-primary transition-colors">INSTAGRAM</a>
              <a href="#" className="hover:text-primary transition-colors">LINKEDIN</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
