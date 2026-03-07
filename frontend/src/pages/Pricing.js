import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Zap, ArrowRight } from "lucide-react";

const plans = [
  {
    name: "Start",
    price: "Gratis",
    desc: "Ideal para testar a agenda e começar a receber clientes.",
    features: ["Pagina publica personalizada", "Lembretes por WhatsApp", "Agenda basica"],
  },
  {
    name: "Pro",
    price: "R$ 49",
    desc: "Para profissionais com agenda cheia e necessidade de controle.",
    features: ["Tudo do Start", "Servicos em destaque", "Relatorios essenciais"],
    highlight: true,
  },
  {
    name: "Studio",
    price: "R$ 99",
    desc: "Para equipes e negocios com multiplos profissionais.",
    features: ["Tudo do Pro", "Equipe multipla", "Suporte prioritario"],
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-background" data-testid="pricing-page">
      <div className="bg-gradient-to-r from-rose-50 to-teal-50 border-b border-border px-4 py-14">
        <div className="max-w-6xl mx-auto text-center">
          <Badge className="bg-secondary text-secondary-foreground gap-2 mb-4">
            <Zap className="h-4 w-4" />
            Planos para cada fase
          </Badge>
          <h1 className="font-heading text-3xl md:text-5xl font-bold tracking-tight">
            Precos simples e transparentes
          </h1>
          <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
            Comece gratis e evolua quando sua agenda crescer. Sem taxas escondidas.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/register">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                Criar conta gratis <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/">
              <Button variant="outline">Voltar ao inicio</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card key={plan.name} className={`shadow-soft ${plan.highlight ? "border-primary" : ""}`}>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-heading text-lg font-semibold">{plan.name}</p>
                {plan.highlight && (
                  <Badge className="bg-primary text-primary-foreground">Popular</Badge>
                )}
              </div>
              <div className="text-3xl font-bold">
                {plan.price}
                {plan.price !== "Gratis" && (
                  <span className="text-sm text-muted-foreground">/mes</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{plan.desc}</p>
              <div className="space-y-2 text-sm text-muted-foreground">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    {feature}
                  </div>
                ))}
              </div>
              <Link to="/register">
                <Button
                  className="w-full"
                  variant={plan.highlight ? "default" : "outline"}
                >
                  Comecar agora
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
