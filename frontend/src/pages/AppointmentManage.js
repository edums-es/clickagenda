import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Clock,
  MapPin,
  User,
  Phone,
  CheckCircle2,
  XCircle,
  Scissors,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

const statusLabels = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  arrived: "Chegou",
  in_progress: "Em atendimento",
  completed: "Concluido",
  cancelled: "Cancelado",
  no_show: "Faltou",
};

export default function AppointmentManage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    loadAppointment();
  }, [token]);

  const loadAppointment = async () => {
    try {
      const res = await api.get(`/appointment/manage/${token}`);
      setData(res.data);
    } catch (err) {
      setError(
        err.response?.status === 404
          ? "Agendamento nao encontrado"
          : "Erro ao carregar agendamento"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setActing(true);
    try {
      await api.post(`/appointment/manage/${token}/confirm`);
      toast.success("Agendamento confirmado!");
      loadAppointment();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erro ao confirmar");
    } finally {
      setActing(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm("Tem certeza que deseja cancelar este agendamento?")) return;
    setActing(true);
    try {
      await api.post(`/appointment/manage/${token}/cancel`);
      toast.success("Agendamento cancelado");
      loadAppointment();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erro ao cancelar");
    } finally {
      setActing(false);
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
          <AlertCircle className="h-12 w-12 text-destructive/50 mx-auto mb-4" />
          <h1 className="font-heading text-2xl font-bold">{error}</h1>
          <p className="text-muted-foreground mt-2">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  const { appointment: apt, professional: pro } = data;
  const canConfirm = ["scheduled"].includes(apt.status);
  const canCancel = ["scheduled", "confirmed"].includes(apt.status);
  const isFinal = ["completed", "cancelled", "no_show"].includes(apt.status);

  return (
    <div className="min-h-screen bg-background" data-testid="appointment-manage-page">
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <CalendarDays className="h-10 w-10 text-primary mx-auto mb-3" />
          <h1 className="font-heading text-2xl font-bold">Seu agendamento</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {pro.business_name || pro.name}
          </p>
        </div>

        <Card className="shadow-soft" data-testid="appointment-details-card">
          <CardContent className="pt-6 space-y-4">
            {/* Status */}
            <div className="text-center">
              <Badge
                variant="outline"
                className={`status-badge status-${apt.status} text-sm px-4 py-1`}
                data-testid="appointment-status"
              >
                {statusLabels[apt.status] || apt.status}
              </Badge>
            </div>

            {/* Details */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3">
                <Scissors className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium">{apt.service_name}</p>
                  {apt.service_price > 0 && (
                    <p className="text-xs text-muted-foreground">R$ {apt.service_price.toFixed(2)}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-primary shrink-0" />
                <p className="text-sm">{apt.date}</p>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-primary shrink-0" />
                <p className="text-sm">{apt.start_time} - {apt.end_time}</p>
              </div>
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-primary shrink-0" />
                <p className="text-sm">{apt.client_name}</p>
              </div>
              {pro.address && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-sm">{pro.address}</p>
                </div>
              )}
              {apt.notes && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                  {apt.notes}
                </div>
              )}
            </div>

            {/* Actions */}
            {!isFinal && (
              <div className="flex gap-3 pt-4">
                {canConfirm && (
                  <Button
                    onClick={handleConfirm}
                    disabled={acting}
                    data-testid="confirm-appointment-btn"
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Confirmar
                  </Button>
                )}
                {canCancel && (
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={acting}
                    data-testid="cancel-appointment-btn"
                    className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10 gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    Cancelar
                  </Button>
                )}
              </div>
            )}

            {isFinal && (
              <p className="text-center text-sm text-muted-foreground pt-2">
                Este agendamento foi {statusLabels[apt.status]?.toLowerCase()}.
              </p>
            )}

            {/* Cancellation policy */}
            {!isFinal && pro.cancellation_policy_hours && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                Cancelamento permitido ate {pro.cancellation_policy_hours}h antes do horario agendado.
              </p>
            )}
          </CardContent>
        </Card>

        {pro.slug && (
          <div className="text-center mt-6">
            <Link to={`/p/${pro.slug}`}>
              <Button variant="ghost" size="sm" className="text-primary" data-testid="back-to-profile-link">
                Voltar ao perfil do profissional
              </Button>
            </Link>
          </div>
        )}

        <footer className="text-center mt-8">
          <p className="text-xs text-muted-foreground">
            Agendamento por{" "}
            <Link to="/" className="text-primary hover:underline font-medium">
              Click Agenda
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
