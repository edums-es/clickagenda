import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Heart, MapPin, Scissors, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function ClientFavorites() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadFavorites(); }, []);

  const loadFavorites = async () => {
    try {
      const res = await api.get("/client/favorites");
      setFavorites(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const removeFavorite = async (proId) => {
    try {
      await api.delete(`/client/favorites/${proId}`);
      setFavorites((prev) => prev.filter((f) => f.user_id !== proId));
      toast.success("Removido dos favoritos");
    } catch { toast.error("Erro ao remover"); }
  };

  const initials = (name) => name ? name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "?";

  return (
    <div className="space-y-6" data-testid="client-favorites-page">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight">Favoritos</h1>
        <p className="text-sm text-muted-foreground mt-1">{favorites.length} profissionais favoritos</p>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">{[1, 2].map((i) => <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : favorites.length === 0 ? (
        <Card className="shadow-soft">
          <CardContent className="py-12 text-center">
            <Heart className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum profissional favoritado</p>
            <Link to="/marketplace">
              <Button variant="link" size="sm" className="mt-2 text-primary" data-testid="find-to-fav">Buscar profissionais</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {favorites.map((pro, i) => (
            <Card key={pro.user_id} className="shadow-soft stagger-item hover:shadow-md transition-all" data-testid={`favorite-card-${i}`}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start gap-3 mb-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={pro.picture} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials(pro.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{pro.business_name || pro.name}</h3>
                    {pro.business_type && <Badge variant="outline" className="text-[10px] mt-1">{pro.business_type}</Badge>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeFavorite(pro.user_id)} data-testid={`unfav-${i}`}>
                    <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
                  </Button>
                </div>
                {(pro.city || pro.address) && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                    <MapPin className="h-3 w-3" /> {pro.city || pro.address}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Scissors className="h-3 w-3" /> {pro.service_count || 0} servicos
                  </span>
                  <div className="flex-1" />
                  <Link to={`/p/${pro.slug}`}>
                    <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1" data-testid={`visit-fav-${i}`}>
                      Agendar <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
