import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CalendarDays, MessageSquare, User, Mail, Lock, Phone, Briefcase, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function Register() {
  const { register, updateUser } = useAuth();
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

  useEffect(() => {
    const raw = localStorage.getItem("pending_client_register");
    if (!raw) return;
    try {
      const pending = JSON.parse(raw);
      setForm((p) => ({
        ...p,
        name: pending.name || p.name,
        email: pending.email || p.email,
        phone: pending.phone || p.phone,
        role: "client",
      }));
    } catch {
      return;
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    setLoading(true);
    try {
      const data = await register(form);
      
      // Original logic for pending client registration
      const raw = localStorage.getItem("pending_client_register");
      let profilePayload = {};
      
      if (raw) {
        try {
          const pending = JSON.parse(raw);
          if (pending.phone) profilePayload.phone = pending.phone;
          if (pending.name && !data?.user?.name) profilePayload.name = pending.name;
        } catch (e) {
          console.error("Error parsing pending register", e);
        }
      }

      // Add new fields to payload if they are filled and not already in pending
      if (form.phone && !profilePayload.phone) profilePayload.phone = form.phone;
      if (form.custom_link) profilePayload.slug = form.custom_link;
      
      if (Object.keys(profilePayload).length > 0) {
        try {
          const profileRes = await api.put("/profile", profilePayload);
          updateUser(profileRes.data);
        } catch (err) {
          console.error("Failed to update profile details", err);
        }
      }

      localStorage.removeItem("pending_client_register");
      toast.success("Conta criada com sucesso!");
      navigate(data?.user?.role === "client" ? "/cliente" : "/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const redirectUrl = window.location.origin + "/auth/callback";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
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
            {/* Account Type Selection - RESTORED */}
            <div className="space-y-3 pt-2">
              <Label className="text-sm font-bold text-gray-700 ml-1">Tipo de conta</Label>
              <RadioGroup
                value={form.role}
                onValueChange={(value) => setForm((p) => ({ ...p, role: value }))}
                className="grid grid-cols-2 gap-3"
              >
                <label className={`flex items-center gap-3 rounded-2xl border p-4 cursor-pointer transition-all ${form.role === 'professional' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-gray-100 bg-gray-50/50 hover:bg-gray-50'}`}>
                  <RadioGroupItem value="professional" id="role-professional" className="sr-only" />
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${form.role === 'professional' ? 'border-primary bg-primary' : 'border-gray-300 bg-white'}`}>
                    {form.role === 'professional' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <span className={`text-sm font-bold ${form.role === 'professional' ? 'text-gray-900' : 'text-gray-500'}`}>Profissional</span>
                </label>
                <label className={`flex items-center gap-3 rounded-2xl border p-4 cursor-pointer transition-all ${form.role === 'client' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-gray-100 bg-gray-50/50 hover:bg-gray-50'}`}>
                  <RadioGroupItem value="client" id="role-client" className="sr-only" />
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${form.role === 'client' ? 'border-primary bg-primary' : 'border-gray-300 bg-white'}`}>
                    {form.role === 'client' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <span className={`text-sm font-bold ${form.role === 'client' ? 'text-gray-900' : 'text-gray-500'}`}>Cliente</span>
                </label>
              </RadioGroup>
            </div>

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

            {/* Business Name - RESTORED */}
            {form.role === "professional" && (
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
            )}

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
              <Label htmlFor="phone" className="text-sm font-bold text-gray-700 ml-1">WhatsApp (com DDD)</Label>
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
                  salaozap.com/
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
                  placeholder="Minimo 6 caracteres"
                  value={form.password}
                  onChange={handleChange}
                  required
                  data-testid="register-password-input"
                  className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 pl-14 pr-6 text-gray-900 focus:bg-white focus:ring-primary/20 transition-all text-base"
                />
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

          <div className="relative my-10">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-[0.2em] font-black text-gray-400">
              <span className="bg-white px-4">OU USE SUA REDE</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="h-14 rounded-2xl border-gray-100 bg-white hover:bg-gray-50 font-bold flex gap-3 shadow-sm hover:shadow-md transition-all active:scale-95 text-gray-700"
              onClick={handleGoogleLogin}
              data-testid="google-register-btn"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google
            </Button>
            <Button
              variant="outline"
              className="h-14 rounded-2xl border-gray-100 bg-white hover:bg-gray-50 font-bold flex gap-3 shadow-sm hover:shadow-md transition-all active:scale-95 text-gray-700"
            >
              <MessageSquare className="w-5 h-5 text-[#25D366] fill-[#25D366]" />
              WhatsApp
            </Button>
          </div>
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
