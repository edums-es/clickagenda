import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, Lock, ArrowLeft, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokenError, setTokenError] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: newPassword });
      toast.success("Senha redefinida com sucesso! Faça login com a nova senha.");
      navigate("/login");
    } catch (err) {
      const status = err.response?.status;
      if (status === 400) {
        setTokenError(true);
      } else {
        toast.error("Erro ao redefinir senha. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
        <div className="space-y-6">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao login
          </Link>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-8 w-8 text-primary" />
            <span className="font-heading font-bold text-2xl">SalãoZap</span>
          </div>
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">
              Redefinir senha
            </h1>
            <p className="text-muted-foreground mt-2">
              Escolha uma nova senha segura para sua conta.
            </p>
          </div>
        </div>

        <div className="w-full max-w-md animate-slide-up lg:ml-auto">
          <Card className="shadow-soft border-border">
            <CardContent className="pt-6 space-y-5">
              {tokenError ? (
                <div className="text-center space-y-4 py-4">
                  <div className="flex justify-center">
                    <AlertCircle className="h-16 w-16 text-destructive" />
                  </div>
                  <h2 className="font-heading font-semibold text-xl">
                    Link inválido ou expirado
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Este link de redefinição não é válido ou já expirou. Solicite um novo.
                  </p>
                  <Link
                    to="/esqueci-senha"
                    className="inline-block text-sm text-primary hover:underline font-medium"
                  >
                    Solicitar novo link
                  </Link>
                </div>
              ) : !token ? (
                <div className="text-center space-y-4 py-4">
                  <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
                  <p className="text-muted-foreground text-sm">
                    Token não encontrado na URL.{" "}
                    <Link to="/esqueci-senha" className="text-primary hover:underline">
                      Solicitar novo link
                    </Link>
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nova senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="new-password"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        data-testid="reset-password-new-input"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder="Repita a nova senha"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        data-testid="reset-password-confirm-input"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    data-testid="reset-password-submit-btn"
                    className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {loading ? "Redefinindo..." : "Redefinir senha"}
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    <Link
                      to="/login"
                      className="text-primary hover:underline font-medium"
                    >
                      Voltar ao login
                    </Link>
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
