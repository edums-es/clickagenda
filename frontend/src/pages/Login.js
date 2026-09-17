import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarDays, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(email, password);
      toast.success("Bem-vindo de volta!");
      navigate(
        data?.user?.role === "superadmin"
          ? "/superadmin"
          : data?.user?.role === "client"
            ? "/cliente"
            : "/dashboard"
      );
    } catch (err) {
      toast.error(err.response?.data?.detail || "Email ou senha incorretos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Blobs */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="w-full max-w-[480px] relative z-10 animate-slide-up">
        {/* Header */}
        <div className="text-center mb-10 flex flex-col items-center">
          <Link to="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-colors text-xs font-bold mb-6 tracking-widest uppercase bg-white/50 backdrop-blur-sm px-4 py-2 rounded-full border border-gray-100 shadow-sm">
            <ArrowLeft className="h-3 w-3" />
            Voltar ao Início
          </Link>
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-primary/20 mb-6 transform transition-transform hover:scale-110">
            <CalendarDays className="w-10 h-10 stroke-[1.5px]" />
          </div>
          <h1 className="text-4xl font-bold font-heading text-gray-900 tracking-tight mb-2">SalãoZap</h1>
          <p className="text-gray-500 font-medium tracking-wide italic">Sua agenda profissional simplificada</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.05)] border border-gray-100 p-8 sm:p-12">
          <div className="mb-10 text-center sm:text-left">
            <h2 className="text-2xl font-bold text-gray-900 font-heading mb-2">Acesse sua conta</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Entre com suas credenciais para gerenciar seus agendamentos
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-bold text-gray-700 ml-1">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="login-email-input"
                className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 px-6 text-gray-900 focus:bg-white focus:ring-primary/20 transition-all text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-bold text-gray-700 ml-1">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="login-password-input"
                  className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 px-6 pr-12 text-gray-900 focus:bg-white focus:ring-primary/20 transition-all text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div className="text-right">
                <Link to="/esqueci-senha" className="text-xs font-bold text-primary hover:text-primary/80">
                  Esqueci minha senha
                </Link>
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="w-5 h-5 rounded-full border-2 border-gray-200 flex items-center justify-center transition-all group-hover:border-primary">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary opacity-0 group-hover:opacity-10 transition-opacity" />
                </div>
                <span className="text-sm font-bold text-gray-500 group-hover:text-gray-700 transition-colors">Lembrar de mim</span>
              </label>
            </div>

            <Button
              type="submit"
              disabled={loading}
              data-testid="login-submit-btn"
              className="w-full h-14 bg-primary hover:bg-primary/90 text-white rounded-2xl text-lg font-bold shadow-xl shadow-primary/20 transition-all active:scale-95"
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

        </div>

        <div className="mt-10 text-center">
          <p className="text-sm font-bold text-gray-500">
            Não tem uma conta?{" "}
            <Link 
              to="/register" 
              data-testid="go-to-register-link"
              className="text-primary hover:text-primary/80 transition-colors underline underline-offset-4 decoration-primary/20"
            >
              Crie sua conta grátis
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
