import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CalendarDays,
  Clock,
  DollarSign,
  MapPin,
  Phone,
  ArrowRight,
  Scissors,
} from "lucide-react";

export default function PublicProfile() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadProfile();
  }, [slug]);

  const loadProfile = async () => {
    try {
      const res = await api.get(`/public/${slug}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.status === 404 ? "Profissional nao encontrado" : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <CalendarDays className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="font-heading text-2xl font-bold">{error}</h1>
          <p className="text-muted-foreground mt-2">Verifique o link e tente novamente.</p>
          <Link to="/">
            <Button variant="outline" className="mt-6">Voltar ao inicio</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { professional, services } = data;
  const initials = professional.name
    ? professional.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <div className="min-h-screen bg-background" data-testid="public-profile-page">
      {/* Header */}
      <div className="bg-gradient-to-br from-teal-50 to-stone-100 px-4 py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <Avatar className="h-20 w-20 border-4 border-white shadow-md">
              <AvatarImage src={professional.picture} alt={professional.name} />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="text-center sm:text-left">
              <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight" data-testid="professional-name">
                {professional.business_name || professional.name}
              </h1>
              {professional.business_name && (
                <p className="text-muted-foreground mt-1">{professional.name}</p>
              )}
              {professional.bio && (
                <p className="text-sm text-muted-foreground mt-2 max-w-lg leading-relaxed">{professional.bio}</p>
              )}
              <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground justify-center sm:justify-start">
                {professional.address && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-primary" /> {professional.address}
                  </span>
                )}
                {professional.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-4 w-4 text-primary" /> {professional.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <h2 className="font-heading text-xl font-semibold mb-6" data-testid="services-heading">
          Servicos disponiveis
        </h2>

        {services.length === 0 ? (
          <Card className="shadow-soft">
            <CardContent className="py-8 text-center">
              <Scissors className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum servico disponivel no momento</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {services.map((svc, i) => (
              <Card
                key={svc.service_id}
                className="shadow-soft stagger-item hover:shadow-md transition-all hover:-translate-y-0.5"
                data-testid={`public-service-${i}`}
              >
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Scissors className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm">{svc.name}</h3>
                      {svc.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{svc.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" /> {svc.duration_minutes}min
                        </span>
                        {svc.price > 0 && (
                          <span className="flex items-center gap-1 text-xs font-medium text-foreground">
                            <DollarSign className="h-3 w-3" /> R$ {svc.price.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Link to={`/p/${slug}/agendar?service=${svc.service_id}`}>
                      <Button
                        size="sm"
                        data-testid={`book-service-${i}`}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 active:scale-95 transition-all"
                      >
                        Agendar
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Sticky bottom CTA on mobile */}
      {services.length > 0 && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-border z-50">
          <Link to={`/p/${slug}/agendar`}>
            <Button
              className="w-full h-12 bg-secondary text-secondary-foreground hover:bg-secondary/90 text-base font-semibold active:scale-95 transition-all"
              data-testid="mobile-book-btn"
            >
              Agendar agora
              <CalendarDays className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-border py-6 px-4 text-center mt-12 mb-20 md:mb-0">
        <p className="text-xs text-muted-foreground">
          Agendamento por{" "}
          <Link to="/" className="text-primary hover:underline font-medium">
            Click Agenda
          </Link>{" "}
          - Clicou, agendou.
        </p>
      </footer>
    </div>
  );
}
