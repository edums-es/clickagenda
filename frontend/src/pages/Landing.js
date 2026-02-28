import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  Clock,
  Users,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  Zap,
  Globe,
} from "lucide-react";

const features = [
  {
    icon: CalendarDays,
    title: "Agenda Inteligente",
    desc: "Visao diaria e semanal com controle total dos seus horarios, pausas e feriados.",
  },
  {
    icon: Globe,
    title: "Pagina Publica",
    desc: "Seu link exclusivo para compartilhar. Clientes agendam direto, sem ligacao.",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp Automatico",
    desc: "Confirmacao e lembretes enviados automaticamente para voce e seu cliente.",
  },
  {
    icon: Users,
    title: "Gestao de Clientes",
    desc: "Historico completo, observacoes e tags para conhecer cada cliente de verdade.",
  },
];

const steps = [
  { num: "01", title: "Configure", desc: "Cadastre seus servicos, horarios e pausas em minutos." },
  { num: "02", title: "Compartilhe", desc: "Envie seu link exclusivo no WhatsApp, Instagram ou onde quiser." },
  { num: "03", title: "Receba", desc: "Clientes agendam sozinhos. Voce recebe a notificacao e gerencia tudo." },
];

export default function Landing() {
  const { user, loading } = useAuth();

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="glass-nav fixed top-0 left-0 right-0 z-50 px-4 md:px-8" data-testid="landing-nav">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            <span className="font-heading font-bold text-xl tracking-tight">Click Agenda</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" data-testid="landing-login-btn" className="text-sm">
                Entrar
              </Button>
            </Link>
            <Link to="/register">
              <Button data-testid="landing-register-btn" className="text-sm bg-primary text-primary-foreground hover:bg-primary/90">
                Comecar gratis
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 md:pt-40 md:pb-32 px-4 md:px-8" data-testid="hero-section">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          <div className="animate-slide-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Zap className="h-3.5 w-3.5" />
              Novo: Agendamento em tempo real
            </div>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-tight">
              Clicou,<br />
              <span className="text-primary">agendou.</span>
            </h1>
            <p className="mt-6 text-base md:text-lg text-muted-foreground leading-relaxed max-w-lg">
              Sua agenda inteligente para profissionais que valorizam cada minuto.
              Seus clientes agendam online, voce gerencia tudo em um so lugar.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register">
                <Button
                  size="lg"
                  data-testid="hero-cta-btn"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md transition-all duration-200 active:scale-95 text-base px-8"
                >
                  Comecar gratis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Gratis para comecar
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Sem cartao
              </span>
            </div>
          </div>

          <div className="animate-slide-up relative" style={{ animationDelay: "0.15s" }}>
            <div className="relative rounded-2xl overflow-hidden shadow-float border border-border">
              <img
                src="https://images.unsplash.com/photo-1559410117-4c12d656c06f?w=600&h=400&fit=crop"
                alt="Profissional agendando"
                className="w-full h-auto object-cover"
              />
              <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md rounded-xl p-4 border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Proximo: 14:30</p>
                    <p className="text-xs text-muted-foreground">Maria - Corte + Escova</p>
                  </div>
                  <div className="ml-auto">
                    <span className="status-badge status-confirmed">Confirmado</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-24 px-4 md:px-8 bg-card" data-testid="features-section">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="font-heading text-3xl md:text-4xl font-semibold tracking-tight">
              Tudo que voce precisa
            </h2>
            <p className="mt-3 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
              Ferramentas simples e poderosas para organizar sua rotina profissional.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="stagger-item rounded-xl border border-border bg-background p-6 transition-all duration-200 hover:shadow-md hover:border-primary/20 hover:-translate-y-1"
                data-testid={`feature-card-${i}`}
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-lg">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 md:py-24 px-4 md:px-8" data-testid="how-it-works-section">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl md:text-4xl font-semibold tracking-tight">
              Simples assim
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.num} className="text-center md:text-left stagger-item">
                <span className="font-heading text-5xl font-bold text-primary/20">{s.num}</span>
                <h3 className="font-heading text-xl font-semibold mt-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24 px-4 md:px-8" data-testid="cta-section">
        <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-teal-50 to-stone-100 rounded-2xl p-8 md:p-12 border border-border">
          <h2 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">
            Pronto para organizar sua agenda?
          </h2>
          <p className="mt-4 text-muted-foreground text-base md:text-lg">
            Comece gratis hoje. Sem complicacao, sem cartao de credito.
          </p>
          <Link to="/register">
            <Button
              size="lg"
              data-testid="cta-register-btn"
              className="mt-8 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md transition-all duration-200 active:scale-95 text-base px-8"
            >
              Criar minha conta gratis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 md:px-8" data-testid="footer">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <span className="font-heading font-bold">Click Agenda</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Clicou, agendou. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
