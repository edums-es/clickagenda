import { useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
    } catch (_) {
      // Silencioso — sempre mostramos a mesma mensagem neutra
    } finally {
      setLoading(false);
      setSubmitted(true);
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
              Esqueceu sua senha?
            </h1>
            <p className="text-muted-foreground mt-2">
              Informe seu e-mail e enviaremos um link para redefinir sua senha.
            </p>
          </div>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Link válido por 1 hora
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Sem necessidade de contato com suporte
            </div>
          </div>
        </div>

        <div className="w-full max-w-md animate-slide-up lg:ml-auto">
          <Card className="shadow-soft border-border">
            <CardContent className="pt-6 space-y-5">
              {submitted ? (
                <div className="text-center space-y-4 py-4">
                  <div className="flex justify-center">
                    <CheckCircle2 className="h-16 w-16 text-primary" />
                  </div>
                  <h2 className="font-heading font-semibold text-xl">
                    Verifique seu e-mail
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Se o e-mail estiver cadastrado, você receberá um link em breve.
                  </p>
                  <Link
                    to="/login"
                    className="inline-block text-sm text-primary hover:underline font-medium"
                  >
                    Voltar ao login
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        data-testid="forgot-password-email-input"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    data-testid="forgot-password-submit-btn"
                    className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {loading ? "Enviando..." : "Enviar link"}
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    Lembrou a senha?{" "}
                    <Link
                      to="/login"
                      className="text-primary hover:underline font-medium"
                    >
                      Fazer login
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
