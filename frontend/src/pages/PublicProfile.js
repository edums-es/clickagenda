import { useState, useEffect, useCallback } from "react";
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
  Facebook,
  Globe,
  Instagram,
  MapPin,
  MessageCircle,
  Phone,
  ArrowRight,
  Scissors,
  Sparkles,
  Droplet,
  HeartPulse,
  Stethoscope,
  Dumbbell,
  Hand,
  Flower2,
} from "lucide-react";

export default function PublicProfile() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProfile = useCallback(async () => {
    try {
      const res = await api.get(`/public/${slug}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.status === 404 ? "Profissional nao encontrado" : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

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

  const { professional, services, featured_services } = data;
  const hasCover = !!professional.cover_picture;
  const initials = professional.name
    ? professional.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";
  const socialLinks = professional.social_links || {};
  const normalizeUrl = (value) => {
    if (!value) return "";
    if (value.startsWith("http://") || value.startsWith("https://")) return value;
    return `https://${value}`;
  };
  const normalizeWhatsapp = (value) => {
    if (!value) return "";
    const digits = value.replace(/\D/g, "");
    return digits ? `https://wa.me/${digits}` : "";
  };
  const linkItems = [
    { key: "instagram", label: "Instagram", icon: Instagram, href: normalizeUrl(socialLinks.instagram || "") },
    { key: "facebook", label: "Facebook", icon: Facebook, href: normalizeUrl(socialLinks.facebook || "") },
    { key: "tiktok", label: "TikTok", icon: Globe, href: normalizeUrl(socialLinks.tiktok || "") },
    { key: "website", label: "Site", icon: Globe, href: normalizeUrl(socialLinks.website || "") },
    { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, href: normalizeWhatsapp(socialLinks.whatsapp || "") },
  ].filter((item) => item.href);
  const featuredList = featured_services || [];
  const servicesList = services || [];
  const featuredIds = new Set(featuredList.map((svc) => svc.service_id));
  const visibleServices = servicesList.filter((svc) => !featuredIds.has(svc.service_id));
  const totalServices = servicesList.length;
  const avgDuration = totalServices
    ? Math.round(servicesList.reduce((acc, svc) => acc + (parseInt(svc.duration_minutes) || 0), 0) / totalServices)
    : 0;
  const avgPrice = totalServices
    ? servicesList.reduce((acc, svc) => acc + (parseFloat(svc.price) || 0), 0) / totalServices
    : 0;
  const headerTitleClass = hasCover ? "text-white" : "text-foreground";
  const headerMutedClass = hasCover ? "text-white/80" : "text-muted-foreground";
  const headerIconClass = hasCover ? "text-white" : "text-primary";
  const headerButtonClass = hasCover ? "border-white/40 text-white hover:bg-white/10 hover:text-white" : "";
  const getServiceIcon = (svc) => {
    const haystack = `${svc.name || ""} ${svc.description || ""} ${professional.business_type || ""}`.toLowerCase();
    if (/(cabelo|barba|barbearia|corte|tesoura|salao)/.test(haystack)) return Scissors;
    if (/(unha|manicure|pedicure|nail)/.test(haystack)) return Hand;
    if (/(massagem|spa|relax|terapia)/.test(haystack)) return Flower2;
    if (/(pele|estetica|sobrancelha|maquiagem|make|design)/.test(haystack)) return Sparkles;
    if (/(fisi|pilates|reabil|cardio)/.test(haystack)) return HeartPulse;
    if (/(clinica|med|doutor|odont|dent|saude)/.test(haystack)) return Stethoscope;
    if (/(personal|treino|academia|fit|muscul)/.test(haystack)) return Dumbbell;
    if (/(tatu|piercing)/.test(haystack)) return Droplet;
    return Scissors;
  };

  return (
    <div className="min-h-screen bg-background" data-testid="public-profile-page">
      <div
        className={`relative px-4 py-12 md:py-16 bg-gradient-to-br from-teal-50 to-stone-100 ${hasCover ? "bg-cover bg-center" : ""}`}
        style={hasCover ? { backgroundImage: `url(${professional.cover_picture})` } : undefined}
      >
        {hasCover && <div className="absolute inset-0 bg-black/40" />}
        <div className="relative max-w-3xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8">
            <Avatar className="h-20 w-20 border-4 border-white shadow-md">
              <AvatarImage src={professional.picture} alt={professional.name} />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="text-center lg:text-left flex-1">
              <h1 className={`font-heading text-3xl md:text-4xl font-bold tracking-tight ${headerTitleClass}`} data-testid="professional-name">
                {professional.business_name || professional.name}
              </h1>
              {professional.business_name && (
                <p className={`mt-1 ${headerMutedClass}`}>{professional.name}</p>
              )}
              {professional.bio && (
                <p className={`text-sm mt-2 max-w-lg leading-relaxed ${headerMutedClass}`}>
                  {professional.bio}
                </p>
              )}
              <div className={`flex flex-wrap items-center gap-4 mt-3 text-sm justify-center sm:justify-start ${headerMutedClass}`}>
                {professional.address && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className={`h-4 w-4 ${headerIconClass}`} /> {professional.address}
                  </span>
                )}
                {professional.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className={`h-4 w-4 ${headerIconClass}`} /> {professional.phone}
                  </span>
                )}
              </div>
              {linkItems.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-4 justify-center sm:justify-start">
                  {linkItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <a key={item.key} href={item.href} target="_blank" rel="noopener noreferrer">
                        <Button
                          variant="outline"
                          size="sm"
                          className={headerButtonClass}
                        >
                          <Icon className="h-4 w-4 mr-2" />
                          {item.label}
                        </Button>
                      </a>
                    );
                  })}
                </div>
              )}
              <div className="mt-6 flex flex-wrap gap-3 justify-center sm:justify-start">
                <Link to={`/p/${slug}/agendar`}>
                  <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 shadow-sm">
                    Agendar agora
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-10">
        <div className="grid sm:grid-cols-3 gap-4">
          <Card className="shadow-soft">
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Servicos disponiveis</p>
              <p className="text-2xl font-semibold mt-2">{totalServices}</p>
              <p className="text-xs text-muted-foreground mt-1">Opcoes para agendar</p>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Duracao media</p>
              <p className="text-2xl font-semibold mt-2">{avgDuration} min</p>
              <p className="text-xs text-muted-foreground mt-1">Por atendimento</p>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Ticket medio</p>
              <p className="text-2xl font-semibold mt-2">R$ {avgPrice.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">Media dos precos</p>
            </CardContent>
          </Card>
        </div>
        {featuredList.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-xl font-semibold" data-testid="featured-services-heading">
              Servicos em destaque
              </h2>
              <Badge className="bg-primary/10 text-primary border-primary/20">Recomendados</Badge>
            </div>
            <div className="space-y-3">
              {featuredList.map((svc, i) => {
                const Icon = getServiceIcon(svc);
                return (
                  <Card
                    key={svc.service_id}
                    className="shadow-soft stagger-item hover:shadow-md transition-all hover:-translate-y-0.5"
                    data-testid={`featured-service-${i}`}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                          <Icon className="h-5 w-5 text-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm">{svc.name}</h3>
                            <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">Destaque</Badge>
                          </div>
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
                          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 active:scale-95 transition-all">
                            Agendar
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
        <div>
          <h2 className="font-heading text-xl font-semibold mb-6" data-testid="services-heading">
            Servicos disponiveis
          </h2>
          {visibleServices.length === 0 ? (
            <Card className="shadow-soft">
              <CardContent className="py-8 text-center">
                <Scissors className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum servico disponivel no momento</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {visibleServices.map((svc, i) => {
                const Icon = getServiceIcon(svc);
                return (
                  <Card
                    key={svc.service_id}
                    className="shadow-soft stagger-item hover:shadow-md transition-all hover:-translate-y-0.5"
                    data-testid={`public-service-${i}`}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                          <Icon className="h-5 w-5 text-foreground" />
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
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sticky bottom CTA on mobile */}
      {services.length > 0 && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-border z-50">
          <Link to={`/p/${slug}/agendar`}>
            <Button
              className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 text-base font-semibold active:scale-95 transition-all"
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
