import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Clock,
  ArrowRight,
  CheckCircle2,
  User,
  Phone,
  Mail,
  CalendarDays,
  Briefcase,
  Home,
  MapPin,
  Share2,
  ChevronRight,
  Instagram,
  Facebook,
  Youtube,
  Globe,
  Video,
  BadgeCheck,
  MessageCircle
} from "lucide-react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const PUBLIC_PROFILE_PREVIEW = {
  professional: {
    name: "Marina Costa",
    business_name: "Studio Aurora",
    business_type: "Beleza & Autocuidado",
    city: "São Paulo",
    state: "SP",
    phone: "11987654321",
    bio: "Um espaço pensado para você se sentir ainda mais confiante. Atendimento com escuta, cuidado e horários reservados só para você.",
    picture: "http://127.0.0.1:8000/uploads/user_67de0e752333_picture_9c7c63b14f.jpg",
    cover_picture: "http://127.0.0.1:8000/uploads/user_67de0e752333_cover_picture_bc0beb2f20.jpg",
    social_links: { instagram: "studioaurora", website: "studioaurora.com" },
  },
  services: [
    { service_id: "preview-design", name: "Design personalizado", description: "Cuidado feito para você", duration_minutes: 60, price: 95, active: true },
    { service_id: "preview-experience", name: "Experiência Aurora", description: "Relaxamento e finalização", duration_minutes: 90, price: 145, active: true },
    { service_id: "preview-return", name: "Manutenção", description: "Para manter seu resultado", duration_minutes: 45, price: 70, active: true },
  ],
  featured_services: [{ service_id: "preview-design" }],
};

export default function PublicProfile() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const preSelectedService = searchParams.get("service");
  const previewMode = process.env.NODE_ENV === "development" && searchParams.get("preview") === "1";

  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  
  const [clientInfo, setClientInfo] = useState({ name: "", phone: "", email: "", notes: "" });
  const [recognizedClient, setRecognizedClient] = useState("");
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  
  const [booking, setBooking] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [pixelId, setPixelId] = useState("");

  // Generates 30 days from today
  const availableDates = Array.from({ length: 30 }).map((_, i) => addDays(new Date(), i));

  useEffect(() => {
    api.get("/public/platform/pixel").then((res) => setPixelId(res.data?.pixel_id || "")).catch(() => {});
  }, []);

  useEffect(() => {
    if (!pixelId || document.getElementById("clickagenda-meta-pixel")) return;
    window.fbq = window.fbq || function () { (window.fbq.q = window.fbq.q || []).push(arguments); };
    window.fbq("init", pixelId);
    const script = document.createElement("script");
    script.id = "clickagenda-meta-pixel";
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }, [pixelId]);

  const trackPixel = (event, params = {}) => {
    if (pixelId && window.fbq) window.fbq("track", event, params);
  };

  useEffect(() => {
    if (pixelId && profileData && window.fbq) {
      window.fbq("track", "PageView");
      window.fbq("track", "ViewContent", { content_name: profileData.professional?.business_name || profileData.professional?.name || "Agenda" });
    }
  }, [pixelId, profileData]);

  const loadProfile = useCallback(async () => {
    if (previewMode) {
      setProfileData(PUBLIC_PROFILE_PREVIEW);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get(`/public/${slug}`);
      setProfileData(res.data);
      
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
  }, [slug, preSelectedService, previewMode]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const loadSlots = async (date) => {
    if (!selectedService) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    if (previewMode) {
      setSlots([
        { start_time: "09:00", end_time: "10:00" },
        { start_time: "10:30", end_time: "11:30" },
        { start_time: "14:00", end_time: "15:00" },
        { start_time: "16:30", end_time: "17:30" },
      ]);
      setLoadingSlots(false);
      return;
    }
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
      trackPixel("InitiateCheckout", { content_name: selectedService?.name || "Agendamento" });
      setIsDataModalOpen(true);
    } else {
      handleBook();
    }
  };

  const recognizeClient = async () => {
    const phone = clientInfo.phone.replace(/\D/g, "");
    if (phone.length < 10) {
      setRecognizedClient("");
      return;
    }
    try {
      const res = await api.get(`/public/${slug}/client-lookup`, { params: { phone } });
      if (res.data?.recognized && res.data?.name) {
        setRecognizedClient(res.data.name);
        setClientInfo((previous) => ({ ...previous, name: previous.name || res.data.name }));
      } else {
        setRecognizedClient("");
      }
    } catch {
      setRecognizedClient("");
    }
  };

  const handleBook = async () => {
    if (!clientInfo.name || !clientInfo.phone) {
      toast.error("Nome e telefone sao obrigatorios");
      return;
    }
    setBooking(true);
    if (previewMode) {
      setConfirmation({
        service_name: selectedService.name,
        date: format(selectedDate, "dd/MM/yyyy"),
        start_time: selectedSlot.start_time,
      });
      setIsDataModalOpen(false);
      setBooking(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
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
      setConfirmation(res.data);
      trackPixel("Lead", { content_name: selectedService?.name || "Agendamento" });
      setIsDataModalOpen(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast.success("Agendamento realizado!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erro ao agendar. Tente outro horario.");
    } finally {
      setBooking(false);
    }
  };

  const shareProfile = async () => {
    const shareData = {
      title: `Agende com ${profileData?.professional?.business_name || profileData?.professional?.name || "este profissional"}`,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link copiado!");
      }
    } catch (error) {
      if (error?.name !== "AbortError") toast.error("Não foi possível compartilhar o link");
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
  const location = [professional.city, professional.state].filter(Boolean).join(", ");
  const social = professional.social_links || {};
  const socialLinks = [
    social.instagram && { label: "Instagram", value: social.instagram, icon: Instagram, href: `https://instagram.com/${social.instagram.replace("@", "")}` },
    social.facebook && { label: "Facebook", value: social.facebook, icon: Facebook, href: `https://facebook.com/${social.facebook}` },
    social.tiktok && { label: "TikTok", value: social.tiktok, icon: Video, href: `https://tiktok.com/@${social.tiktok.replace("@", "")}` },
    social.youtube && { label: "YouTube", value: social.youtube, icon: Youtube, href: `https://youtube.com/${social.youtube}` },
    social.website && { label: "Site", value: social.website, icon: Globe, href: social.website.startsWith("http") ? social.website : `https://${social.website}` },
  ].filter(Boolean);
  const whatsappLink = professional.phone
    ? `https://wa.me/${professional.phone.replace(/\D/g, "")}`
    : null;
  const featuredIds = new Set((profileData.featured_services || []).map((service) => service.service_id));
  const featuredServices = services.filter((service) => featuredIds.has(service.service_id));
  const otherServices = services.filter((service) => !featuredIds.has(service.service_id));
  const orderedServices = [...featuredServices, ...otherServices];

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
              Sua reserva foi confirmada com sucesso. Guarde estes detalhes para o seu atendimento.
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
            <Button className="w-full h-14 bg-[#00D49D] hover:bg-[#00B98A] text-white text-[15px] font-bold rounded-xl shadow-lg shadow-[#00D49D]/25 transition-all active:scale-[0.98]" onClick={() => window.location.reload()}>
              <CheckCircle2 className="h-5 w-5 mr-2" />
              Concluido
            </Button>
            
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
           {location && <><MapPin className="h-3 w-3 inline-block mr-1"/>{location}<br/></>}
           Agendamento online por {displayName}.
        </div>
      </div>
    );
  }

  // BOOKING VIEW
  return (
    <div className="min-h-screen bg-[#f1f8f5] pb-40 font-sans" data-testid="public-profile-page">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[430px] bg-[radial-gradient(circle_at_50%_0%,rgba(20,184,143,0.18),transparent_62%)]" />
      <div className="relative mx-auto max-w-xl px-4 pt-7 sm:px-5 sm:pt-10">
        <section className="overflow-hidden rounded-[34px] bg-white shadow-[0_24px_70px_rgba(26,78,63,0.16)] ring-1 ring-[#dcefe8]">
          <div
            className="relative h-32 bg-gradient-to-br from-[#0ebc91] via-[#26c6a2] to-[#60d7c3] sm:h-40"
            style={professional.cover_picture ? { backgroundImage: `url(${professional.cover_picture})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
          >
            <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(5,86,67,0.25),transparent_52%,rgba(255,255,255,0.12))]" />
            <div className="absolute -bottom-16 -right-12 h-40 w-40 rounded-full border-[18px] border-white/20" />
            <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/15 px-3 py-1.5 text-[11px] font-bold tracking-wide text-white backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-[#d7fff5] shadow-[0_0_12px_#d7fff5]" />
              AGENDA ABERTA
            </div>
            <button onClick={shareProfile} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-white/35 bg-white/15 text-white backdrop-blur-md transition hover:scale-105 hover:bg-white/25" aria-label="Compartilhar perfil">
              <Share2 className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 pb-6 text-center sm:px-8">
            <Avatar className="-mt-14 mx-auto h-28 w-28 border-[5px] border-white bg-white shadow-[0_12px_30px_rgba(20,74,60,0.22)] sm:h-32 sm:w-32">
              <AvatarImage src={professional.picture} alt={displayName} />
              <AvatarFallback className="bg-[#dff9f0] text-3xl font-black text-[#08745b]">{initials}</AvatarFallback>
            </Avatar>
            <div className="mt-4 flex items-center justify-center gap-1.5">
              <h1 className="font-heading text-[26px] font-black tracking-tight text-[#102a24] sm:text-3xl">{displayName}</h1>
              <BadgeCheck className="h-5 w-5 shrink-0 fill-[#16b890] text-white" aria-label="Perfil verificado" />
            </div>
            <p className="mt-1.5 text-sm font-bold text-[#049b78]">{professional.business_type || "Atendimento com horário marcado"}</p>

            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
              {whatsappLink && <a href={whatsappLink} target="_blank" rel="noopener noreferrer" aria-label="Conversar pelo WhatsApp" className="grid h-10 w-10 place-items-center rounded-full border border-[#c9e7de] bg-white text-[#0d9474] shadow-sm transition hover:-translate-y-0.5 hover:border-[#47c9ad] hover:bg-[#effcf7]"><MessageCircle className="h-4.5 w-4.5" /></a>}
              {socialLinks.slice(0, 3).map(({ label, icon: Icon, href }) => <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className="grid h-10 w-10 place-items-center rounded-full border border-[#c9e7de] bg-white text-[#0d9474] shadow-sm transition hover:-translate-y-0.5 hover:border-[#47c9ad] hover:bg-[#effcf7]"><Icon className="h-4 w-4" /></a>)}
              <button onClick={shareProfile} aria-label="Copiar link do perfil" className="grid h-10 w-10 place-items-center rounded-full border border-[#c9e7de] bg-white text-[#0d9474] shadow-sm transition hover:-translate-y-0.5 hover:border-[#47c9ad] hover:bg-[#effcf7]"><Share2 className="h-4 w-4" /></button>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-[#55746b]">
              {location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[#078b6d]" />{location}</span>}
              {location && <span className="h-1 w-1 rounded-full bg-[#b3cec5]" />}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e6f8f2] px-3 py-1.5 text-[#078b6d]"><CalendarDays className="h-3.5 w-3.5" />Reservas online</span>
            </div>
            {professional.bio && <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-[#536f67]">{professional.bio}</p>}

            <button onClick={() => document.getElementById("agendamento")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="mt-6 flex w-full items-center justify-between rounded-2xl bg-[#0db892] px-5 py-4 text-left text-white shadow-[0_12px_26px_rgba(13,184,146,0.25)] transition hover:-translate-y-0.5 hover:bg-[#099f7d] active:translate-y-0">
              <span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/18"><CalendarDays className="h-5 w-5" /></span><span><span className="block text-sm font-black">Agendar agora</span><span className="mt-0.5 block text-xs text-white/80">Escolha um serviço e seu melhor horário</span></span></span>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/18"><ArrowRight className="h-4 w-4" /></span>
            </button>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 overflow-hidden rounded-2xl border border-[#dcefe8] bg-white shadow-[0_10px_30px_rgba(23,75,60,0.06)]">
          <div className="flex items-center gap-3 px-4 py-3.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e6f8f2] text-[#078b6d]"><Briefcase className="h-4 w-4" /></span><span><span className="block text-[11px] font-bold uppercase tracking-wide text-[#89a69d]">Serviços</span><span className="block text-sm font-black text-[#1c4036]">{services.length} disponíveis</span></span></div>
          <div className="flex items-center gap-3 border-l border-[#e6f1ed] px-4 py-3.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e6f8f2] text-[#078b6d]"><Clock className="h-4 w-4" /></span><span><span className="block text-[11px] font-bold uppercase tracking-wide text-[#89a69d]">Reserva</span><span className="block text-sm font-black text-[#1c4036]">Em poucos passos</span></span></div>
        </section>

        {/* Section 1: Services */}
        <div id="agendamento" className="mt-6 mb-8 scroll-mt-4">
          <div className="mb-4 flex items-end justify-between px-1">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#138c76]">Agendamento</p><h2 className="mt-1 font-heading text-xl font-black tracking-tight text-[#17342f]">Escolha seu serviço</h2></div>
            <span className="rounded-full bg-[#def7ee] px-3 py-1.5 text-xs font-bold text-[#147661]">1 de 3</span>
          </div>
          <div className="space-y-3">
            {orderedServices.map((svc) => {
              const isActive = selectedService?.service_id === svc.service_id;
              const isFeatured = featuredIds.has(svc.service_id);
              return (
                <button
                  key={svc.service_id}
                  onClick={() => setSelectedService(svc)}
                  className={`group relative flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all ${
                    isActive ? "border-[#13a189] bg-[#e7faf3] shadow-[0_10px_22px_rgba(19,161,137,0.12)]" : "border-white bg-white shadow-[0_6px_18px_rgba(23,52,47,0.05)] hover:-translate-y-0.5 hover:border-[#bfeade]"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><h3 className="truncate font-black text-[#17342f] text-sm">{svc.name}</h3>{isFeatured && <span className="rounded-full bg-[#dff8ee] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#168b76]">Destaque</span>}</div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-[#728982] font-semibold">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {svc.duration_minutes} min
                      </span>
                      {svc.description && <span className="truncate max-w-[160px]">• {svc.description}</span>}
                    </div>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-3"><span className="text-sm font-black text-[#17342f]">{svc.price > 0 ? `R$ ${svc.price.toFixed(2).replace(".", ",")}` : "A combinar"}</span><div className={`grid h-7 w-7 place-items-center rounded-full transition-colors ${isActive ? "bg-[#13a189] text-white" : "bg-[#edf8f4] text-[#168b76]"}`}><ChevronRight className="h-4 w-4" /></div></div>
                </button>
              );
            })}
            {services.length === 0 && <div className="rounded-2xl border border-dashed border-[#b9d8ce] bg-white p-8 text-center text-sm font-medium text-[#678078]">Este profissional ainda não publicou serviços.</div>}
          </div>
        </div>

        {/* Section 2: Date */}
        <div className={`mb-8 transition-opacity duration-300 ${!selectedService ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
          <div className="flex items-center justify-between mb-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#138c76]">Próximo passo</p><h2 className="mt-1 font-heading text-xl font-black tracking-tight text-[#17342f]">Escolha a data</h2></div>
            <span className="rounded-full bg-[#def7ee] px-3 py-1.5 text-xs font-bold text-[#147661]">
               {selectedDate ? format(selectedDate, "MMM", { locale: ptBR }) : "2 de 3"}
            </span>
            <span className="hidden text-[13px] font-semibold text-muted-foreground capitalize">
               {selectedDate ? format(selectedDate, "MMMM yyyy", { locale: ptBR }) : ""}
            </span>
          </div>
          
          <div 
            className="flex gap-2.5 overflow-x-auto pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden snap-x px-1 -mx-1"
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
                      ? "bg-[#13a189] text-white shadow-md shadow-[#13a189]/25 scale-105"
                      : "bg-white border border-white text-[#17342f] hover:border-[#bfeade] shadow-[0_5px_14px_rgba(23,52,47,0.05)]"
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
          <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#138c76]">Quase lá</p><h2 className="mt-1 font-heading text-xl font-black tracking-tight text-[#17342f]">Horários disponíveis</h2></div><span className="rounded-full bg-[#def7ee] px-3 py-1.5 text-xs font-bold text-[#147661]">3 de 3</span></div>
          
          <div className="bg-white rounded-[22px] p-[18px] shadow-[0_8px_24px_rgba(23,52,47,0.06)] border border-white">
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
                          ? "border-[#13a189] bg-[#e7faf3] text-[#168b76]"
                          : "border-[#dce9e4] bg-white text-[#17342f] hover:border-[#8fd9c5] hover:bg-[#f5fcf8] shadow-sm"
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
        className={`fixed bottom-0 left-0 right-0 border-t border-[#dce9e4] bg-white/95 shadow-[0_-15px_40px_rgba(23,52,47,0.10)] p-4 backdrop-blur-xl md:p-5 transition-transform duration-300 z-50 ${
          selectedSlot ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-[11px] text-[#728982] font-bold tracking-widest uppercase">Seu horário</p>
              <p className="text-xl md:text-2xl font-black text-[#17342f] leading-none mt-1">
                {selectedService?.price > 0 ? `R$ ${selectedService.price.toFixed(2).replace(".", ",")}` : "A combinar"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold text-[#17342f] text-[13px] md:text-sm">
                {selectedDate && format(selectedDate, "EEE, dd MMM", { locale: ptBR }).replace(".", "")}
              </p>
              <p className="text-[#728982] text-[13px] md:text-sm font-semibold">
                as {selectedSlot?.start_time}
              </p>
            </div>
          </div>
          
          <Button 
            className="w-full h-[54px] bg-[#13a189] hover:bg-[#0f8d78] text-white text-[15px] font-bold rounded-2xl shadow-lg shadow-[#13a189]/25 transition-all active:scale-[0.98]"
            onClick={handleConfirmClick}
            disabled={booking}
          >
            {booking ? "Confirmando..." : "Continuar para confirmação"} <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <p className="text-[10px] md:text-xs text-center text-[#789088] mt-3 font-medium">
            Você informará seus dados apenas para concluir a reserva.
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
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground font-bold text-xs tracking-wide">Telefone *</Label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  value={clientInfo.phone}
                  onChange={(e) => {
                    setRecognizedClient("");
                    setClientInfo((p) => ({ ...p, phone: e.target.value }));
                  }}
                  onBlur={recognizeClient}
                  placeholder="(11) 99999-9999"
                  className="pl-10 h-12 rounded-xl bg-neutral-50/80 border-border/60 hover:border-border focus:border-[#00D49D] font-medium"
                />
              </div>
              {recognizedClient && (
                <p className="text-xs font-medium text-emerald-700">Bem-vindo de volta, {recognizedClient}!</p>
              )}
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
