import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarDays, User, Mail, Lock, Phone, Briefcase, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ 
    name: "", 
    email: "", 
    password: "", 
    phone: "", 
    custom_link: "", 
    business_name: "", 
    role: "professional" 
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 10 || !/[a-zA-Z]/.test(form.password) || !/\d/.test(form.password)) {
      toast.error("Use ao menos 10 caracteres, com letras e números");
      return;
    }
    setLoading(true);
    try {
      const data = await register(form);
      
      toast.success("Conta criada com sucesso!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Blobs */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="w-full max-w-[520px] relative z-10 py-12 animate-slide-up">
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
            <h2 className="text-2xl font-bold text-gray-900 font-heading mb-2">Crie sua conta</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Comece seu teste grátis de 7 dias hoje
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-bold text-gray-700 ml-1">Nome completo</Label>
              <div className="relative">
                <User className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                <Input
                  id="name"
                  name="name"
                  placeholder="Ex: João Silva"
                  value={form.name}
                  onChange={handleChange}
                  required
                  data-testid="register-name-input"
                  className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 pl-14 pr-6 text-gray-900 focus:bg-white focus:ring-primary/20 transition-all text-base"
                />
              </div>
            </div>

            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <Label htmlFor="business_name" className="text-sm font-bold text-gray-700 ml-1">Nome do negócio (opcional)</Label>
                <div className="relative">
                  <Briefcase className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                  <Input
                    id="business_name"
                    name="business_name"
                    placeholder="Ex: Meu Salão"
                    value={form.business_name}
                    onChange={handleChange}
                    data-testid="register-business-input"
                    className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 pl-14 pr-6 text-gray-900 focus:bg-white focus:ring-primary/20 transition-all text-base"
                  />
                </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-bold text-gray-700 ml-1">Email</Label>
              <div className="relative">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                  data-testid="register-email-input"
                  className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 pl-14 pr-6 text-gray-900 focus:bg-white focus:ring-primary/20 transition-all text-base"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-bold text-gray-700 ml-1">Telefone (com DDD)</Label>
              <div className="relative">
                <Phone className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                <Input
                  id="phone"
                  name="phone"
                  placeholder="(11) 99999-9999"
                  value={form.phone}
                  onChange={handleChange}
                  required
                  className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 pl-14 pr-6 text-gray-900 focus:bg-white focus:ring-primary/20 transition-all text-base"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom_link" className="text-sm font-bold text-gray-700 ml-1">Seu link personalizado</Label>
              <div className="flex items-stretch gap-0 bg-gray-50/50 rounded-2xl border border-gray-100 focus-within:ring-primary/20 transition-all overflow-hidden">
                <div className="bg-gray-100 border-r border-gray-100 px-5 flex items-center text-xs font-bold text-gray-400">
                  clickagenda.com/
                </div>
                <Input
                  id="custom_link"
                  name="custom_link"
                  placeholder="seu-nome"
                  value={form.custom_link}
                  onChange={handleChange}
                  className="h-14 border-0 bg-transparent flex-1 px-4 text-gray-900 focus:ring-0 text-base"
                />
              </div>
              <p className="text-[10px] text-gray-400 font-bold ml-1">Este será o endereço da sua página de agendamentos.</p>
            </div>

            <div className="space-y-2 pt-2">
              <Label htmlFor="password" className="text-sm font-bold text-gray-700 ml-1">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  minLength={10}
                  placeholder="10+ caracteres, letras e números"
                  value={form.password}
                  onChange={handleChange}
                  required
                  data-testid="register-password-input"
                  className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 pl-14 pr-6 text-gray-900 focus:bg-white focus:ring-primary/20 transition-all text-base"
                />
                <p className="text-[10px] text-gray-400 font-medium ml-1">Use 10 ou mais caracteres, incluindo letras e números.</p>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              data-testid="register-submit-btn"
              className="w-full h-14 bg-primary hover:bg-primary/90 text-white rounded-2xl text-lg font-bold shadow-xl shadow-primary/20 transition-all active:scale-95 mt-4"
            >
              {loading ? "Criando conta..." : "Criar minha conta"}
            </Button>
          </form>

        </div>

        <div className="mt-10 text-center">
          <p className="text-sm font-bold text-gray-500">
            Já tem uma conta?{" "}
            <Link to="/login" className="text-primary hover:text-primary/80 transition-colors underline underline-offset-4 decoration-primary/20" data-testid="go-to-login-link">
              Entre aqui
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
