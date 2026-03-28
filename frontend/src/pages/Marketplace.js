import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Search, MapPin, Scissors, Heart, ArrowRight, Zap, Filter, CalendarDays,
} from "lucide-react";
import { toast } from "sonner";

export default function Marketplace() {
  const { user } = useAuth();
  const [professionals, setProfessionals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cities, setCities] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showOffersOnly, setShowOffersOnly] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [locating, setLocating] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedCity) params.set("city", selectedCity);
      if (selectedCategory) params.set("category", selectedCategory);

      const [proRes, catRes, cityRes] = await Promise.all([
        api.get(`/marketplace?${params.toString()}`),
        api.get("/marketplace/categories"),
        api.get("/marketplace/cities"),
      ]);
      setProfessionals(proRes.data.professionals);
      setCategories(catRes.data);
      setCities(cityRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search, selectedCity, selectedCategory]);

  useEffect(() => {
    const t = setTimeout(loadData, 300);
    return () => clearTimeout(t);
  }, [loadData]);

  useEffect(() => {
    if (user) {
      api.get("/client/favorites").then((res) => {
        setFavorites(res.data.map((f) => f.user_id));
      }).catch(() => {});
    }
  }, [user]);
  
  useEffect(() => {
    if (user?.city && !selectedCity && !locationQuery) {
      setSelectedCity(user.city);
      setLocationQuery(user.city);
    }
  }, [user, selectedCity, locationQuery]);

  const toggleFavorite = async (proId) => {
    if (!user) {
      toast.error("Faca login para favoritar");
      return;
    }
    try {
      if (favorites.includes(proId)) {
        await api.delete(`/client/favorites/${proId}`);
        setFavorites((prev) => prev.filter((id) => id !== proId));
        toast.success("Removido dos favoritos");
      } else {
        await api.post(`/client/favorites/${proId}`);
        setFavorites((prev) => [...prev, proId]);
        toast.success("Adicionado aos favoritos");
      }
    } catch { toast.error("Erro ao favoritar"); }
  };

  const initials = (name) => name ? name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "?";
  const visibleProfessionals = showOffersOnly
    ? professionals.filter((pro) => pro.has_offers)
    : professionals;
  const topCategories = categories.slice(0, 4);
  const topCities = cities.slice(0, 4);
  const handleCitySelect = (value) => {
    const normalized = value === "all" ? "" : value;
    setSelectedCity(normalized);
    setLocationQuery(normalized);
  };
  const handleLocationChange = (value) => {
    setLocationQuery(value);
    setSelectedCity(value);
  };
  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocalizacao nao suportada");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
          );
          const data = await res.json();
          const address = data.address || {};
          const city =
            address.city ||
            address.town ||
            address.village ||
            address.suburb ||
            address.county ||
            "";
          if (!city) {
            toast.error("Nao foi possivel identificar a cidade");
            return;
          }
          setSelectedCity(city);
          setLocationQuery(city);
        } catch {
          toast.error("Erro ao detectar localizacao");
        } finally {
          setLocating(false);
        }
      },
      () => {
        toast.error("Permissao de localizacao negada");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  return (
    <div className="min-h-screen bg-background" data-testid="marketplace-page">
      {/* Header */}
      <div className="bg-gradient-to-br from-teal-50 to-stone-100 px-4 py-8 md:py-12 border-b border-border">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            <Link to="/" className="font-heading font-bold text-xl text-primary">SalãoZap</Link>
          </div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight mt-4" data-testid="marketplace-title">
            Encontre profissionais perto de voce
          </h1>
          <p className="text-muted-foreground mt-2 text-base">
            Agende servicos com os melhores profissionais da sua regiao.
          </p>

          {/* Search */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, servico ou tipo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="marketplace-search"
                className="pl-10 h-11 bg-white"
              />
            </div>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cidade ou bairro"
                value={locationQuery}
                onChange={(e) => handleLocationChange(e.target.value)}
                data-testid="marketplace-location-input"
                className="pl-10 h-11 bg-white"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleUseLocation}
              disabled={locating}
              className="h-11 gap-2"
              data-testid="marketplace-use-location"
            >
              <MapPin className="h-4 w-4" />
              {locating ? "Localizando..." : "Minha localizacao"}
            </Button>
            <Select value={selectedCity} onValueChange={handleCitySelect}>
              <SelectTrigger className="w-full sm:w-48 h-11 bg-white" data-testid="marketplace-city-filter">
                <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Cidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as cidades</SelectItem>
                {cities.map((c) => (
                  <SelectItem key={c.city} value={c.city}>
                    {c.city}{c.state ? ` - ${c.state}` : ""} ({c.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value === "all" ? "" : value)}>
              <SelectTrigger className="w-full sm:w-48 h-11 bg-white" data-testid="marketplace-category-filter">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.name} value={c.name}>
                    {c.name} ({c.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
            <Button
              variant={showOffersOnly ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowOffersOnly((prev) => !prev)}
              className="gap-2 shrink-0"
              data-testid="marketplace-offers-toggle"
            >
              <Zap className="h-4 w-4" />
              Ofertas turbo
            </Button>
            <Button
              variant={user?.city && selectedCity === user.city ? "secondary" : "outline"}
              size="sm"
              onClick={() => handleCitySelect(user?.city || "")}
              className="gap-2 shrink-0"
              disabled={!user?.city}
              data-testid="marketplace-my-city"
            >
              <MapPin className="h-4 w-4" />
              Minha cidade
            </Button>
            {topCategories.map((c) => (
              <Button
                key={c.name}
                variant={selectedCategory === c.name ? "secondary" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(selectedCategory === c.name ? "" : c.name)}
                className="shrink-0"
                data-testid={`quick-category-${c.name}`}
              >
                {c.name}
              </Button>
            ))}
            {topCities.map((c) => (
              <Button
                key={c.city}
                variant={selectedCity === c.city ? "secondary" : "outline"}
                size="sm"
                onClick={() => setSelectedCity(selectedCity === c.city ? "" : c.city)}
                className="shrink-0"
                data-testid={`quick-city-${c.city}`}
              >
                {c.city}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : visibleProfessionals.length === 0 ? (
          <div className="text-center py-16">
            {showOffersOnly ? (
              <>
                <Zap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h2 className="font-heading text-xl font-semibold">Nenhuma oferta turbo ativa</h2>
                <p className="text-muted-foreground mt-2">Tente remover o filtro ou ajustar sua busca.</p>
              </>
            ) : (
              <>
                <Search className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h2 className="font-heading text-xl font-semibold">Nenhum profissional encontrado</h2>
                <p className="text-muted-foreground mt-2">Tente ajustar sua busca ou filtros.</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleProfessionals.map((pro, i) => (
              <Card key={pro.user_id} className="shadow-soft stagger-item hover:shadow-md transition-all hover:-translate-y-1 group" data-testid={`marketplace-card-${i}`}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={pro.picture} alt={pro.name} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {initials(pro.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">
                        {pro.business_name || pro.name}
                      </h3>
                      {pro.business_name && (
                        <p className="text-xs text-muted-foreground truncate">{pro.name}</p>
                      )}
                      {pro.business_type && (
                        <Badge variant="outline" className="mt-1 text-[10px]">{pro.business_type}</Badge>
                      )}
                    </div>
                    {user && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={(e) => { e.preventDefault(); toggleFavorite(pro.user_id); }}
                        data-testid={`favorite-btn-${i}`}
                      >
                        <Heart className={`h-4 w-4 ${favorites.includes(pro.user_id) ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}`} />
                      </Button>
                    )}
                  </div>

                  {pro.bio && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{pro.bio}</p>}

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
                    {(pro.city || pro.address) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {pro.city || pro.address}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Scissors className="h-3 w-3" /> {pro.service_count || 0} servicos
                    </span>
                    {pro.has_offers && (
                      <span className="flex items-center gap-1 text-secondary font-medium">
                        <Zap className="h-3 w-3" /> Ofertas
                      </span>
                    )}
                  </div>

                  <Link to={`/p/${pro.slug}`}>
                    <Button size="sm" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5" data-testid={`visit-profile-${i}`}>
                      Ver perfil <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
