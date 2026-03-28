import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Star, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ClientReview() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const fetchApt = async () => {
      try {
        const res = await api.get(`/reviews/appointment/${id}`);
        setData(res.data);
      } catch (err) {
        setError(true);
        if (err.response?.status === 400 && err.response?.data?.detail === "Agendamento já avaliado") {
          setSubmitted(true);
          setError(false);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchApt();
  }, [id]);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Por favor, selecione uma nota de 1 a 5 estrelas!");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/reviews/${id}`, {
        rating,
        comment
      });
      setSubmitted(true);
      toast.success("Avaliação enviada com sucesso!");
    } catch (err) {
      if (err.response?.data?.detail) {
        toast.error(err.response.data.detail);
      } else {
        toast.error("Erro ao enviar avaliação.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="h-10 w-10 border-4 border-[#00D49D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || (!data && !submitted)) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-6 border-border/50 shadow-sm rounded-2xl">
          <CardTitle className="text-xl font-heading mb-2">Agendamento não encontrado</CardTitle>
          <CardDescription className="mb-6">O link pode ter expirado ou é inválido.</CardDescription>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-border/50 shadow-sm rounded-2xl overflow-hidden py-10 px-6 text-center animate-fade-in-up">
          <div className="bg-emerald-50 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-black font-heading text-foreground mb-2">Obrigado pela sua avaliação!</h2>
          <p className="text-[#64748B] text-sm max-w-[280px] mx-auto leading-relaxed mb-8">
            Sua opinião é muito importante para continuarmos melhorando nossos serviços e ajudando outros clientes.
          </p>
          <span className="font-heading font-bold text-2xl text-primary">SalãoZap</span>
        </Card>
      </div>
    );
  }

  const { client_name, professional_name, professional_picture, service_name, date } = data;
  const firstName = client_name?.split(" ")[0] || "Cliente";

  let aptDateObj = null;
  if (date) {
    const parts = date.split("-");
    if (parts.length === 3) aptDateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  }
  const dateFormatted = aptDateObj ? format(aptDateObj, "dd 'de' MMMM", { locale: ptBR }) : date;

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4 py-10">
      <div className="mb-6 flex justify-center">
        <div className="flex items-center gap-2 font-heading font-bold text-lg text-foreground bg-white px-4 py-2 rounded-full shadow-sm">
          <div className="h-6 w-6 rounded-md bg-[#00D49D] text-white flex items-center justify-center text-xs">C</div>
          SalãoZap
        </div>
      </div>

      <Card className="max-w-md w-full border-border/50 shadow-soft rounded-2xl overflow-hidden animate-fade-in-up">
        <CardHeader className="text-center pb-6 border-b border-border/30 bg-white">
          <Avatar className="h-20 w-20 mx-auto border-4 border-white shadow-md mb-4">
            <AvatarImage src={professional_picture} />
            <AvatarFallback className="bg-primary/5 text-primary text-xl font-bold">
              {professional_name?.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-xl font-black font-heading text-foreground mb-1">
            Olá, {firstName}!
          </h2>
          <CardDescription className="text-sm">
            Como foi o <strong>{service_name}</strong> com <strong>{professional_name}</strong> dia {dateFormatted}?
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-8 px-6 pb-8 bg-white/50 space-y-8">
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm font-bold text-foreground uppercase tracking-wider">Sua Nota</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="transition-transform active:scale-90 touch-manipulation p-1"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                >
                  <Star 
                    className={`h-11 w-11 transition-all ${(hoverRating || rating) >= star ? "fill-yellow-400 text-yellow-400 drop-shadow-sm scale-110" : "fill-neutral-200 text-neutral-200"}`} 
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-xs font-bold text-[#00D49D] animate-fade-in bg-[#00D49D]/10 px-3 py-1 rounded-full mt-2">
                {rating === 1 && "Muito ruim"}
                {rating === 2 && "Ruim"}
                {rating === 3 && "Razoável"}
                {rating === 4 && "Muito bom"}
                {rating === 5 && "Excelente!"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-bold text-foreground">Comentário (opcional)</p>
            <Textarea 
              placeholder="O que você mais gostou no atendimento?" 
              className="resize-none h-28 bg-white border-border/60 focus-visible:ring-[#00D49D] text-base placeholder:text-muted-foreground/60 rounded-xl"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <Button 
            className="w-full h-12 bg-[#00D49D] hover:bg-[#00B98A] text-white font-bold text-base rounded-xl shadow-md shadow-[#00D49D]/20 transition-all active:scale-[0.98]"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Enviando..." : "Enviar Avaliação"}
          </Button>
        </CardContent>
      </Card>
      <p className="text-[11px] text-muted-foreground/60 mt-8 font-medium">
        Powered by SalãoZap
      </p>
    </div>
  );
}
