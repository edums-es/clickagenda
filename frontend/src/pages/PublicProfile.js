import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Clock,
  ArrowRight,
  CheckCircle2,
  Star,
  CheckCircle,
  User,
  Phone,
  Mail,
  MessageCircle,
  CalendarDays,
  Briefcase,
  Home,
  MapPin,
  Instagram,
  Facebook,
  Youtube,
  Globe,
  Video
} from "lucide-react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function PublicProfile() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const preSelectedService = searchParams.get("service");

  const [profileData, setProfileData] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  
  const [clientInfo, setClientInfo] = useState({ name: "", phone: "", email: "", notes: "" });
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  
  const [booking, setBooking] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [whatsappLink, setWhatsappLink] = useState(null);
  const isClientUser = user?.role === "client";

  const datesContainerRef = useRef(null);

  // Generates 30 days from today
  const availableDates = Array.from({ length: 30 }).map((_, i) => addDays(new Date(), i));

  const loadProfile = useCallback(async () => {
    try {
      const [res, revRes] = await Promise.all([
        api.get(`/public/${slug}`),
        api.get(`/public/${slug}/reviews`).catch(() => ({ data: null }))
      ]);
      setProfileData(res.data);
      if (revRes.data) setReviews(revRes.data);
      
      if (preSelectedService && res.data?.services) {
        const svc = res.data.services.find((s) => s.service_id === preSelectedService);
        if (svc) setSelectedService(svc);
      } else if (res.data?.services?.length > 0) {
        // Uncomment if you want to auto-select the first service: 
        // setSelectedService(res.data.services[0]);
      }
    } catch {
      toast.error("Erro ao carregar perfil do profissional");
    } finally {
      setLoading(false);
    }
  }, [slug, preSelectedService]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  useEffect(() => {
    if (!isClientUser) return;
    setClientInfo((prev) => ({
      ...prev,
      name: user?.name || prev.name,
      phone: user?.phone || prev.phone,
      email: user?.email || prev.email,
    }));
  }, [isClientUser, user]);

  const loadSlots = async (date) => {
    if (!selectedService) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const res = await api.get(`/public/${slug}/slots?date=${dateStr}&service_id=${selectedService.service_id}`);
      setSlots(res.data.slots || []);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleDateSelect = (date) => {
    if (!selectedService) {
      toast.error("Por favor, selecione um servico primeiro.");
      return;
    }
    setSelectedDate(date);
    loadSlots(date);
  };

  useEffect(() => {
    if (selectedDate && selectedService) {
      loadSlots(selectedDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedService]);

  const handleConfirmClick = () => {
    if (!clientInfo.name || !clientInfo.phone) {
      setIsDataModalOpen(true);
    } else {
      handleBook();
    }
  };

  const handleBook = async () => {
    if (!clientInfo.name || !clientInfo.phone) {
      toast.error("Nome e telefone sao obrigatorios");
      return;
    }
    setBooking(true);
    try {
      const res = await api.post(`/public/${slug}/book`, {
        service_id: selectedService.service_id,
        client_name: clientInfo.name,
        client_phone: clientInfo.phone,
        client_email: clientInfo.email,
        date: format(selectedDate, "yyyy-MM-dd"),
        start_time: selectedSlot.start_time,
        notes: clientInfo.notes,
      });
      if (isClientUser) {
        const profilePayload = {};
        if (!user?.phone && clientInfo.phone) profilePayload.phone = clientInfo.phone;
        if (!user?.email && clientInfo.email) profilePayload.email = clientInfo.email;
        if (!user?.name && clientInfo.name) profilePayload.name = clientInfo.name;
        if (Object.keys(profilePayload).length > 0) {
          const profileRes = await api.put("/profile", profilePayload);
          updateUser(profileRes.data);
        }
      }
      if (!user) {
        localStorage.setItem(
          "pending_client_register",
          JSON.stringify({ name: clientInfo.name, phone: clientInfo.phone, email: clientInfo.email })
        );
      }
      setConfirmation(res.data);
      setWhatsappLink(res.data.whatsapp_link || null);
      setIsDataModalOpen(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast.success("Agendamento realizado!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erro ao agendar. Tente outro horario.");
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profileData) return null;
  const { professional, services } = profileData;
  const displayName = professional.business_name || professional.name;
  const initials = displayName ? displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "?";

  // CONFIRMATION VIEW
  if (confirmation) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] px-4 py-8 md:py-12 flex flex-col items-center" data-testid="step-confirmation">
        
        {/* Top Navbar Simulation */}
        <div className="fixed top-0 left-0 right-0 bg-white border-b border-border/50 px-6 py-4 flex items-center justify-between z-50">
           <div className="flex items-center gap-2">
             <div className="h-8 w-8 bg-[#00D49D] rounded-lg flex items-center justify-center">
               <CalendarDays className="text-white h-4 w-4" />
             </div>
             <span className="font-heading font-bold text-foreground text-lg">Agendamento</span>
           </div>
           <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
             <span className="cursor-pointer hover:text-primary">Meus Agendamentos</span>
             <span className="cursor-pointer hover:text-primary">Servicos</span>
             <span className="cursor-pointer hover:text-primary">Configuracoes</span>
             <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-transparent hover:ring-[#00D49D] transition-all">
               <AvatarImage src={professional.picture} alt={displayName} />
               <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">{initials}</AvatarFallback>
             </Avatar>
           </div>
        </div>

        <div className="w-full max-w-xl bg-white rounded-[32px] p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border/40 mt-16 md:mt-24">
          <div className="flex flex-col items-center text-center">
            {/* Success Icon */}
            <div className="h-28 w-28 bg-[#00D49D]/10 rounded-full flex items-center justify-center mb-6">
              <div className="h-16 w-16 bg-[#00D49D] rounded-full flex items-center justify-center shadow-lg shadow-[#00D49D]/30">
                <CheckCircle2 className="h-10 w-10 text-white stroke-[3]" />
              </div>
            </div>
            
            <h1 className="text-2xl md:text-[32px] font-black font-heading text-foreground mb-3 tracking-tight">
              Agendamento Realizado!
            </h1>
            <p className="text-[#64748B] text-sm md:text-base px-4 mb-10 font-medium">
              Sua reserva foi confirmada com sucesso. O profissional já foi notificado.
            </p>
          </div>

          {/* Details Card */}
          <div className="bg-[#F8FAFC] rounded-2xl p-6 md:p-8 mb-8 border border-neutral-100">
            <h3 className="flex items-center gap-2 font-bold text-foreground mb-6 text-lg">
              <div className="h-5 w-5 rounded-full bg-[#00D49D] flex items-center justify-center shrink-0">
                <div className="h-1.5 w-1.5 bg-white rounded-full"/>
              </div>
              Detalhes da Reserva
            </h3>
            
            <div className="space-y-5">
              {/* Servico */}
              <div className="flex items-center justify-between pb-5 border-b border-border/50">
                <div className="flex items-center gap-2.5 text-[#64748B]">
                  <Briefcase className="h-4 w-4" />
                  <span className="text-sm font-semibold">Servico</span>
                </div>
                <span className="font-bold text-foreground flex-1 text-right truncate pl-4">
                  {confirmation.service_name}
                </span>
              </div>
              
              {/* Data */}
              <div className="flex items-center justify-between pb-5 border-b border-border/50">
                <div className="flex items-center gap-2.5 text-[#64748B]">
                  <CalendarDays className="h-4 w-4" />
                  <span className="text-sm font-semibold">Data</span>
                </div>
                <span className="font-bold text-foreground">
                  {confirmation.date}
                </span>
              </div>
              
              {/* Horario */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-[#64748B]">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-semibold">Horario</span>
                </div>
                <span className="font-bold text-foreground">
                  {confirmation.start_time}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {whatsappLink ? (
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="block w-full">
                <Button className="w-full h-14 bg-[#00D49D] hover:bg-[#00B98A] text-white text-[15px] font-bold rounded-xl shadow-lg shadow-[#00D49D]/25 transition-all active:scale-[0.98]">
                  <MessageCircle className="h-5 w-5 mr-2" fill="currentColor" />
                  Confirmar no WhatsApp
                </Button>
              </a>
            ) : (
                <Button className="w-full h-14 bg-[#00D49D] hover:bg-[#00B98A] text-white text-[15px] font-bold rounded-xl shadow-lg shadow-[#00D49D]/25 transition-all active:scale-[0.98]" onClick={() => window.location.reload()}>
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Concluido
                </Button>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <Button variant="outline" className="h-14 w-full rounded-xl font-bold text-[#475569] bg-[#F1F5F9] border-transparent hover:bg-[#E2E8F0] active:scale-[0.98] transition-all">
                <CalendarDays className="h-4 w-4 mr-2 text-[#64748B]" /> Adicionar ao Calendario
              </Button>
              <Button variant="outline" className="h-14 w-full rounded-xl font-bold text-[#475569] bg-[#F1F5F9] border-transparent hover:bg-[#E2E8F0] active:scale-[0.98] transition-all" onClick={() => window.location.reload()}>
                <Home className="h-4 w-4 mr-2 text-[#64748B]" /> Voltar ao Inicio
              </Button>
            </div>
          </div>
        </div>
        
        <div className="mt-12 text-center text-xs text-[#94A3B8] font-medium space-y-1">
           <MapPin className="h-3 w-3 inline-block mr-1"/> Sao Paulo, Brasil<br/>
           © 2024 Agendamento SaaS. Todos os direitos reservados.
        </div>
      </div>
    );
  }

  // BOOKING VIEW
  return (
    <div className="min-h-screen bg-neutral-50 pb-40 font-sans" data-testid="public-profile-page">
      {/* Header */}
      <div className="bg-white border-b border-border/50 sticky top-0 z-40 px-4 py-3 flex items-center justify-between shadow-sm">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 bg-[#00D49D] rounded-lg flex items-center justify-center shrink-0 shadow-sm">
            <CalendarDays className="text-white h-4 w-4" />
          </div>
          <span className="font-heading font-bold text-foreground text-lg">AgendeAqui</span>
        </Link>
        {!user && (
          <Link to="/login">
            <Button variant="ghost" className="text-[#00D49D] font-medium">Entrar</Button>
          </Link>
        )}
      </div>

      <div className="max-w-xl mx-auto px-4 pt-8 md:pt-10">
        {/* Profile Info */}
        <div className="flex flex-col items-center text-center mb-10 animate-fade-in space-y-3">
          <div className="relative inline-block">
            <Avatar className="h-24 w-24 border-4 border-white shadow-md">
              <AvatarImage src={professional.picture} alt={professional.name} />
              <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="absolute bottom-1 right-1 h-5 w-5 rounded-full bg-[#00D49D] border-[3px] border-white" />
          </div>
          
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              {displayName}
            </h1>
            <p className="text-sm text-[#00D49D] font-medium mt-0.5">
              {professional.business_type || professional.bio || "Profissional parceiro"}
            </p>
          </div>
          
          {professional.social_links && Object.values(professional.social_links).some(v => v) && (
            <div className="flex items-center justify-center gap-4 mt-1">
              {professional.social_links.instagram && (
                <a href={`https://instagram.com/${professional.social_links.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-green-600 transition-colors">
                  <Instagram className="h-[18px] w-[18px]" />
                </a>
              )}
              {professional.social_links.whatsapp && (
                <a href={`https://wa.me/${professional.social_links.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-green-600 transition-colors">
                  <MessageCircle className="h-[18px] w-[18px]" />
                </a>
              )}
              {professional.social_links.facebook && (
                <a href={`https://facebook.com/${professional.social_links.facebook}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-green-600 transition-colors">
                  <Facebook className="h-[18px] w-[18px]" />
                </a>
              )}
              {professional.social_links.tiktok && (
                <a href={`https://tiktok.com/@${professional.social_links.tiktok.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-green-600 transition-colors">
                  <Video className="h-[18px] w-[18px]" />
                </a>
              )}
              {professional.social_links.youtube && (
                <a href={`https://youtube.com/${professional.social_links.youtube}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-green-600 transition-colors">
                  <Youtube className="h-[18px] w-[18px]" />
                </a>
              )}
              {professional.social_links.website && (
                <a href={professional.social_links.website.startsWith('http') ? professional.social_links.website : `https://${professional.social_links.website}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-green-600 transition-colors">
                  <Globe className="h-[18px] w-[18px]" />
                </a>
              )}
            </div>
          )}

          <div className="flex flex-col items-center gap-4">
            {professional.bio && professional.bio.length > 5 && (
              <p className="text-xs sm:text-sm text-muted-foreground max-w-sm leading-relaxed">
                {professional.bio}
              </p>
            )}
            
            <div className="flex flex-wrap items-center justify-center gap-2">
              <div className="flex items-center gap-1.5 bg-white border border-border/50 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm text-foreground">
                <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 mb-0.5" />
                {reviews?.total > 0 ? reviews.average : "5.0"} <span className="text-muted-foreground font-medium">({reviews?.total || 120} avaliacoes)</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white border border-border/50 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm text-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#00D49D] fill-[#00D49D]/20" />
                Verificado
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: Services */}
        <div className="mb-8">
          <h2 className="font-heading text-lg font-bold mb-4 flex items-center gap-2">
            <div className="h-6 w-6 bg-[#00D49D]/10 text-[#00D49D] rounded flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>
            </div>
            Selecione o servico
          </h2>
          <div className="space-y-3">
            {services.map((svc) => {
              const isActive = selectedService?.service_id === svc.service_id;
              return (
                <div
                  key={svc.service_id}
                  onClick={() => setSelectedService(svc)}
                  className={`group relative flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    isActive ? "border-[#00D49D] bg-[#00D49D]/[0.03]" : "border-border/50 bg-white hover:border-border"
                  }`}
                >
                  <div>
                    <h3 className="font-bold text-foreground text-sm">{svc.name}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {svc.duration_minutes} min
                      </span>
                      {svc.price > 0 && <span className="font-bold text-foreground">R$ {svc.price.toFixed(2).replace(".", ",")}</span>}
                    </div>
                  </div>
                  <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${isActive ? "border-[#00D49D]" : "border-muted-foreground/30 group-hover:border-muted-foreground/50"}`}>
                    {isActive && <div className="h-2.5 w-2.5 bg-[#00D49D] rounded-full" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Date */}
        <div className={`mb-8 transition-opacity duration-300 ${!selectedService ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg font-bold flex items-center gap-2">
              <div className="h-6 w-6 bg-[#00D49D]/10 text-[#00D49D] rounded flex items-center justify-center shrink-0">
                <CalendarDays className="h-3.5 w-3.5" />
              </div>
              Escolha a data
            </h2>
            <span className="text-[13px] font-semibold text-muted-foreground capitalize">
               {selectedDate ? format(selectedDate, "MMMM yyyy", { locale: ptBR }) : ""}
            </span>
          </div>
          
          <div 
            ref={datesContainerRef}
            className="flex gap-2.5 overflow-x-auto pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden snap-x px-4 -mx-4 md:px-0 md:mx-0"
            style={{ scrollBehavior: 'smooth' }}
          >
            {availableDates.map((date) => {
              const isActive = selectedDate && date.toDateString() === selectedDate.toDateString();
              const dayName = format(date, "EEE", { locale: ptBR }).toUpperCase().replace(".", "");
              const dayNum = format(date, "dd");
              
              return (
                <button
                  key={date.toISOString()}
                  onClick={() => handleDateSelect(date)}
                  className={`flex shrink-0 flex-col items-center justify-center w-[60px] h-20 rounded-2xl transition-all snap-start ${
                    isActive 
                      ? "bg-[#00D49D] text-white shadow-md shadow-[#00D49D]/20 scale-105" 
                      : "bg-white border text-foreground hover:bg-neutral-50 border-transparent hover:border-border"
                  }`}
                  style={!isActive ? { boxShadow: "0 2px 8px -2px rgba(0,0,0,0.05)" } : {}}
                >
                  <span className={`text-[10px] font-bold tracking-widest ${isActive ? "text-white/90" : "text-muted-foreground"}`}>{dayName}</span>
                  <span className="text-[22px] font-black mt-0.5">{dayNum}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 3: Time */}
        <div className={`mb-12 transition-opacity duration-300 ${!selectedDate ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
          <h2 className="font-heading text-lg font-bold mb-4 flex items-center gap-2">
            <div className="h-6 w-6 bg-[#00D49D]/10 text-[#00D49D] rounded flex items-center justify-center shrink-0">
              <Clock className="h-3.5 w-3.5" />
            </div>
            Horarios disponiveis
          </h2>
          
          <div className="bg-white rounded-2xl p-[18px] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-transparent">
            {loadingSlots ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-10 bg-neutral-100/80 outline-none rounded-xl animate-pulse" />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6 font-medium">
                Nenhum horario disponivel para esta data.
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {slots.map((slot) => {
                  const isActive = selectedSlot?.start_time === slot.start_time;
                  return (
                    <button
                      key={slot.start_time}
                      onClick={() => setSelectedSlot(slot)}
                      className={`h-[42px] rounded-xl text-sm font-bold transition-all border ${
                        isActive
                          ? "border-[#00D49D] bg-[#00D49D]/10 text-[#00D49D]"
                          : "border-border/60 bg-white text-foreground hover:border-border hover:bg-neutral-50 shadow-sm"
                      }`}
                    >
                      {slot.start_time}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div 
        className={`fixed bottom-0 left-0 right-0 bg-white border-t border-border/50 shadow-[0_-15px_40px_rgba(0,0,0,0.05)] p-4 md:p-6 transition-transform duration-300 z-50 ${
          selectedSlot ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="max-w-xl mx-auto">
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-[11px] text-muted-foreground font-bold tracking-widest uppercase">Total</p>
              <p className="text-xl md:text-2xl font-black text-foreground leading-none mt-1">
                R$ {selectedService?.price > 0 ? selectedService.price.toFixed(2).replace(".", ",") : "0,00"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold text-foreground text-[13px] md:text-sm">
                {selectedDate && format(selectedDate, "EEE, dd MMM", { locale: ptBR }).replace(".", "")}
              </p>
              <p className="text-muted-foreground text-[13px] md:text-sm font-semibold">
                as {selectedSlot?.start_time}
              </p>
            </div>
          </div>
          
          <Button 
            className="w-full h-[52px] bg-[#00D49D] hover:bg-[#00B98A] text-white text-[15px] font-bold rounded-xl shadow-lg shadow-[#00D49D]/25 transition-all active:scale-[0.98]"
            onClick={handleConfirmClick}
            disabled={booking}
          >
            {booking ? "Confirmando..." : "Confirmar Agendamento"} <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <p className="text-[10px] md:text-xs text-center text-muted-foreground mt-3 font-medium">
            Ao confirmar, voce concorda com os <a href="#" className="underline">Termos de Uso</a> e <a href="#" className="underline">Politica de Cancelamento</a>.
          </p>
        </div>
      </div>

      {/* Client Data Modal for unauthenticated / incomplete profiles */}
      <Dialog open={isDataModalOpen} onOpenChange={setIsDataModalOpen}>
        <DialogContent className="w-[90vw] max-w-md border-0 shadow-2xl rounded-3xl p-6 gap-6">
          <DialogHeader className="mb-0 text-left">
            <DialogTitle className="text-2xl font-heading font-black">Falta pouco!</DialogTitle>
            <p className="text-[13px] font-medium text-muted-foreground mt-1">Preencha seus dados para finalizar o agendamento.</p>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-foreground font-bold text-xs tracking-wide">Nome completo *</Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  value={clientInfo.name}
                  onChange={(e) => setClientInfo((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Joao da Silva"
                  className="pl-10 h-12 rounded-xl bg-neutral-50/80 border-border/60 hover:border-border focus:border-[#00D49D] font-medium"
                  disabled={isClientUser && !!user?.name}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground font-bold text-xs tracking-wide">WhatsApp *</Label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  value={clientInfo.phone}
                  onChange={(e) => setClientInfo((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                  className="pl-10 h-12 rounded-xl bg-neutral-50/80 border-border/60 hover:border-border focus:border-[#00D49D] font-medium"
                  disabled={isClientUser && !!user?.phone}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground font-bold text-xs tracking-wide">E-mail (opcional)</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  value={clientInfo.email}
                  onChange={(e) => setClientInfo((p) => ({ ...p, email: e.target.value }))}
                  placeholder="seu@email.com"
                  className="pl-10 h-12 rounded-xl bg-neutral-50/80 border-border/60 hover:border-border focus:border-[#00D49D] font-medium"
                  disabled={isClientUser && !!user?.email}
                />
              </div>
            </div>
          </div>
          
          <div className="mt-2 flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => setIsDataModalOpen(false)} 
              className="h-12 flex-1 rounded-xl text-foreground font-bold border-border shadow-sm hover:bg-neutral-50"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleBook}
              disabled={booking || !clientInfo.name || !clientInfo.phone}
              className="h-12 flex-1 bg-[#00D49D] hover:bg-[#00B98A] text-white font-bold rounded-xl shadow-lg shadow-[#00D49D]/20 active:scale-95 transition-all"
            >
              {booking ? "Processando..." : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
