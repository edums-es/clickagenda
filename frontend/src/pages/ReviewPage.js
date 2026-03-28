import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function ReviewPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadAppointment = async () => {
      try {
        const res = await api.get(`/appointments/manage/${token}`);
        setAppointment(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || "Erro ao carregar agendamento");
      } finally {
        setLoading(false);
      }
    };
    loadAppointment();
  }, [token]);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Selecione uma nota de 1 a 5 estrelas");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/reviews/${token}`, {
        appointment_id: appointment.appointment_id,
        rating,
        comment,
      });
      setSubmitted(true);
      toast.success("Avaliacao enviada!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erro ao enviar avaliacao");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-soft">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">{error || "Agendamento nao encontrado"}</p>
            <Link to="/">
              <Button>Ir para o inicio</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full shadow-soft text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <div className="mx-auto bg-green-100 p-3 rounded-full w-fit">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-heading font-bold text-green-700">Obrigado!</h2>
            <p className="text-muted-foreground">Sua avaliacao foi enviada com sucesso.</p>
            <Link to={`/p/${appointment.professional_slug}`}>
              <Button variant="outline" className="mt-4">
                Voltar ao perfil do profissional
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (appointment.status !== "completed") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full shadow-soft text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <div className="mx-auto bg-amber-100 p-3 rounded-full w-fit">
              <CheckCircle2 className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-heading font-bold">Agendamento nao concluido</h2>
            <p className="text-muted-foreground">
              Voce so pode avaliar um agendamento apos ele ser marcado como concluido pelo profissional.
            </p>
            <Link to={`/agendamento/${token}`}>
              <Button variant="outline" className="mt-4">
                Voltar aos detalhes
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full shadow-soft">
        <CardHeader>
          <CardTitle className="text-center font-heading text-2xl">Avalie seu atendimento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-1">
            <p className="text-sm text-muted-foreground">Profissional</p>
            <p className="font-medium text-lg">{appointment.professional_name}</p>
            <p className="text-sm text-muted-foreground mt-2">Servico realizado</p>
            <p className="font-medium">{appointment.service_name}</p>
          </div>

          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="transition-transform hover:scale-110 focus:outline-none"
              >
                <Star
                  className={`h-10 w-10 ${
                    star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
                  }`}
                />
              </button>
            ))}
          </div>
          <div className="text-center text-sm font-medium text-muted-foreground h-4">
            {rating === 1 && "Ruim"}
            {rating === 2 && "Razoavel"}
            {rating === 3 && "Bom"}
            {rating === 4 && "Muito bom"}
            {rating === 5 && "Excelente!"}
          </div>

          <div className="space-y-2">
            <Label>Deixe um comentario (opcional)</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Conte como foi sua experiencia..."
              maxLength={300}
              rows={4}
            />
            <p className="text-xs text-right text-muted-foreground">
              {comment.length}/300
            </p>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {submitting ? "Enviando..." : "Enviar avaliacao"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
