import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, MapPin, Share2, ArrowRight, ChevronLeft, ChevronRight, Check, MessageCircle, Scissors } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import BookingConfirmation from '@/components/BookingConfirmation';
import { normalizeMobile, formatPhone, bookingWhatsApp, whatsappLink, displayDate, socialUrl } from '@/lib/booking';

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const preview = {
  professional: { name: 'Marina Costa', business_name: 'Studio Aurora', business_type: 'Beleza e autocuidado', city: 'São Paulo', state: 'SP', bio: 'Cuidado feito para você. Escolha seu serviço e reserve um horário só seu.' },
  services: [{ service_id: 'preview', name: 'Design personalizado', description: 'Avaliação, preparação e finalização com atenção a cada detalhe. Um atendimento pensado para realçar o seu estilo.', price: 95, duration_minutes: 60 }],
};

export default function PublicProfile() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const previewMode = process.env.NODE_ENV === 'development' && params.get('preview') === '1';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [service, setService] = useState(null);
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [week, setWeek] = useState(0);
  const [dialog, setDialog] = useState(false);
  const [client, setClient] = useState({ name: '', phone: '', email: '' });
  const [formError, setFormError] = useState('');
  const [booking, setBooking] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const submitting = useRef(false);
  const attempt = useRef(null);
  const timingRef = useRef(null);
  const storageKey = 'clickagenda:booking:' + slug;
  const [pixel, setPixel] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(''); setService(null); setDate(''); setSlot(null); setConfirmation(null);
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      if (saved && Date.now() - saved.savedAt < 86400000) setConfirmation(saved.booking);
    } catch {}
    const load = async () => {
      try {
        const result = previewMode ? preview : (await api.get('/public/' + encodeURIComponent(slug), { signal: controller.signal })).data;
        if (controller.signal.aborted) return;
        setData(result);
        setService(result.services.find((item) => item.service_id === params.get('service')) || null);
      } catch (err) {
        if (!controller.signal.aborted) setError(err.response?.status === 404 ? 'Esta agenda não foi encontrada.' : 'Não foi possível carregar a agenda. Tente novamente.');
      }
    };
    load();
    return () => controller.abort();
  }, [slug, storageKey, previewMode, params]);

  useEffect(() => {
    if (previewMode) return;
    api.get('/public/platform/pixel').then(({ data }) => setPixel(data.pixel_id || '')).catch(() => {});
  }, [previewMode]);
  useEffect(() => {
    if (!pixel || !/^\d+$/.test(pixel)) return;
    if (!window.fbq) {
      const fbq = function () { fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
      fbq.queue = []; fbq.loaded = true; fbq.version = '2.0'; window.fbq = fbq;
      const script = document.createElement('script'); script.async = true; script.src = 'https://connect.facebook.net/en_US/fbevents.js'; document.head.appendChild(script);
    }
    window.fbq('init', pixel); window.fbq('track', 'PageView');
  }, [pixel]);

  useEffect(() => {
    setSlot(null); setSlots([]); setSlotsError(false);
    if (!service || !date) { setSlotsLoading(false); return; }
    const controller = new AbortController();
    setSlotsLoading(true);
    if (previewMode) { setSlots([{ start_time: '09:00' }, { start_time: '14:30' }]); setSlotsLoading(false); return; }
    api.get('/public/' + encodeURIComponent(slug) + '/slots', { params: { date, service_id: service.service_id }, signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setSlots(data.slots || []); })
      .catch(() => { if (!controller.signal.aborted) setSlotsError(true); })
      .finally(() => { if (!controller.signal.aborted) setSlotsLoading(false); });
    return () => controller.abort();
  }, [slug, service, date, previewMode, retry]);

  const selectService = (item) => {
    setService(item); setSlot(null);
    requestAnimationFrame(() => timingRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
  };

  const book = async (event) => {
    event.preventDefault();
    if (submitting.current || !service || !date || !slot) return;
    const phone = normalizeMobile(client.phone);
    if (!phone) { setFormError('Informe um WhatsApp válido com DDD. Números repetidos ou sequências não são aceitos.'); return; }
    if (client.name.trim().length < 2 || !/[\p{L}]/u.test(client.name)) { setFormError('Informe seu nome para identificar a reserva.'); return; }
    submitting.current = true; setBooking(true); setFormError('');
    const payload = { service_id: service.service_id, client_name: client.name.trim(), client_phone: phone, client_email: client.email.trim(), date, start_time: slot.start_time };
    const signature = JSON.stringify(payload);
    if (attempt.current?.signature !== signature) attempt.current = { signature, id: crypto.randomUUID() };
    try {
      const result = previewMode ? { ...payload, appointment_id: 'preview', service_name: service.name } : (await api.post('/public/' + encodeURIComponent(slug) + '/book', { ...payload, booking_request_id: attempt.current.id })).data;
      const saved = { ...result, whatsapp_url: result.whatsapp_url || bookingWhatsApp(result, data.professional) };
      setConfirmation(saved); setDialog(false);
      try { sessionStorage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), booking: saved })); } catch {}
      if (pixel && window.fbq) window.fbq('track', 'Lead', { content_name: service.name });
      window.scrollTo({ top: 0 });
      // The receipt is saved before navigation. Returning from WhatsApp never books twice.
      if (!previewMode && saved.whatsapp_url) window.location.assign(saved.whatsapp_url);
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Não conseguimos confirmar. Tente novamente; não criaremos uma reserva duplicada.');
      if (err.response?.status === 409) { setDialog(false); setSlot(null); setRetry((v) => v + 1); toast.error('Esse horário acabou de ser ocupado. Escolha outro.'); }
    } finally { submitting.current = false; setBooking(false); }
  };

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: data.professional.business_name || data.professional.name, url: window.location.href });
      else { await navigator.clipboard.writeText(window.location.href); toast.success('Link copiado'); }
    } catch (err) { if (err.name !== 'AbortError') toast.error('Não foi possível compartilhar'); }
  };

  if (error) return <main className="grid min-h-[100dvh] place-items-center p-6"><div className="max-w-sm text-center"><h1 className="text-2xl font-bold">{error}</h1><Button className="mt-6" onClick={() => window.location.reload()}>Tentar novamente</Button></div></main>;
  if (!data) return <main className="mx-auto max-w-xl space-y-4 p-4" aria-busy="true" aria-label="Carregando agenda"><div className="h-64 animate-pulse rounded-3xl bg-emerald-50" />{[0,1,2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)}</main>;
  const { professional, services } = data;
  if (confirmation) return <BookingConfirmation booking={confirmation} professional={professional} onBack={() => { setConfirmation(null); setSlot(null); attempt.current = null; try { sessionStorage.removeItem(storageKey); } catch {} setRetry((v) => v + 1); }} />;
  const name = professional.business_name || professional.name;
  const location = [professional.city, professional.state].filter(Boolean).join(' · ');
  const contact = whatsappLink(professional.phone);
  const dates = Array.from({ length: 7 }, (_, index) => addDays(new Date(), week * 7 + index));
  return <main className="booking-page min-h-[100dvh] bg-[#f1f8f5] pb-40" data-testid="public-profile-page">
    <div className="mx-auto w-full min-w-0 max-w-xl px-4 pt-4 sm:pt-8">
      <section className="overflow-hidden rounded-[1.75rem] bg-white shadow-soft">
        <div className="relative h-28 bg-gradient-to-br from-emerald-600 to-teal-300 sm:h-36">
          {professional.cover_picture && <img src={professional.cover_picture} alt="" className="h-full w-full object-cover" />}
          <button className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-white/90 text-emerald-800" onClick={share} aria-label="Compartilhar agenda"><Share2 className="h-5 w-5" /></button>
        </div>
        <div className="px-5 pb-6">
          <div className="relative -mt-10 mb-3 grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-emerald-50 text-2xl font-bold text-emerald-800 shadow-sm">
            {professional.picture ? <img src={professional.picture} alt={name} className="h-full w-full object-cover" /> : name.slice(0, 2).toUpperCase()}
          </div>
          <h1 className="break-words text-2xl font-bold text-slate-900">{name}</h1>
          <p className="mt-1 text-sm font-semibold text-emerald-700">{professional.business_type || 'Atendimento com hora marcada'}</p>
          {location && <p className="mt-3 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-4 w-4 shrink-0" />{location}</p>}
          {professional.bio && <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-slate-600">{professional.bio}</p>}
          <div className="mt-3 flex flex-wrap gap-2">{Object.entries(professional.social_links || {}).map(([platform, value]) => {
            const url = socialUrl(platform, value);
            return url ? <a key={platform} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl border px-3 text-xs font-semibold capitalize text-slate-600">{platform}</a> : null;
          })}</div>
          {contact && <a href={contact} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-50 px-4 text-sm font-semibold text-emerald-800"><MessageCircle className="h-4 w-4" />Tirar uma dúvida</a>}
        </div>
      </section>
      <section className="mt-7" aria-labelledby="services-title">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">1 · Serviço</p><h2 id="services-title" className="mb-4 mt-1 text-xl font-bold">O que vamos agendar?</h2>
        <div className="space-y-3">
          {services.map((item) => <button key={item.service_id} type="button" aria-pressed={service?.service_id === item.service_id} onClick={() => selectService(item)} data-testid={'book-service-' + item.service_id} className={'flex w-full min-w-0 gap-3 rounded-2xl border-2 p-3.5 text-left transition-colors ' + (service?.service_id === item.service_id ? 'border-emerald-600 bg-emerald-50' : 'border-transparent bg-white hover:border-emerald-200')}>
            {item.image_url ? <img src={item.image_url} alt={item.name} loading="lazy" className="h-20 w-20 shrink-0 rounded-xl object-cover" /> : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Scissors className="h-6 w-6" /></span>}
            <span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-2"><span className="break-words text-sm font-bold">{item.name}</span>{service?.service_id === item.service_id && <Check className="h-4 w-4 shrink-0 text-emerald-700" />}</span>
              {item.description && <span className="mt-1 block whitespace-pre-line break-words text-xs leading-relaxed text-slate-500">{item.description}</span>}
              <span className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="inline-flex items-center gap-1 text-xs text-slate-500"><Clock className="h-3.5 w-3.5" />{item.duration_minutes} min</span><span className="text-sm font-bold text-emerald-800">{money(item.price)}</span></span>
            </span>
          </button>)}
          {!services.length && <p className="rounded-2xl bg-white p-5 text-sm text-slate-600">Nenhum serviço publicado. {contact && <a href={contact} className="font-bold text-emerald-700 underline">Fale com o profissional.</a>}</p>}
        </div>
      </section>
      {service && <section ref={timingRef} className="mt-7 min-w-0 scroll-mt-4" aria-labelledby="time-title">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">2 · Data e horário</p><h2 id="time-title" className="mt-1 text-xl font-bold">Qual o melhor momento?</h2>
        <div className="my-3 flex items-center justify-between gap-2"><Button aria-label="Semana anterior" size="icon" variant="ghost" className="h-11 w-11 shrink-0" disabled={week === 0} onClick={() => setWeek((v) => v - 1)}><ChevronLeft className="h-5 w-5" /></Button><p className="text-center text-sm font-semibold capitalize">{format(dates[0], 'dd MMM', { locale: ptBR })} — {format(dates[6], 'dd MMM', { locale: ptBR })}</p><Button aria-label="Próxima semana" size="icon" variant="ghost" className="h-11 w-11 shrink-0" disabled={week === 7} onClick={() => setWeek((v) => v + 1)}><ChevronRight className="h-5 w-5" /></Button></div>
        <div className="grid grid-cols-7 gap-1.5">{dates.map((day) => { const key = format(day, 'yyyy-MM-dd'); return <button type="button" aria-label={format(day, "EEEE, dd 'de' MMMM", { locale: ptBR })} aria-pressed={date === key} key={key} onClick={() => { setDate(key); setSlot(null); }} className={'min-w-0 rounded-xl px-0.5 py-3 text-center ' + (date === key ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700')}><span className="block text-[10px] capitalize">{format(day, 'EEE', { locale: ptBR })}</span><span className="mt-1 block text-lg font-bold">{format(day, 'dd')}</span></button>; })}</div>
        {date && <div className="mt-4 rounded-2xl bg-white p-4" aria-live="polite" aria-busy={slotsLoading}>
          <h3 className="mb-3 text-sm font-semibold">Horários · {displayDate(date)}</h3>
          {slotsLoading ? <p className="py-5 text-sm text-slate-500">Buscando horários…</p> : slotsError ? <div className="text-sm"><p>Não foi possível consultar os horários.</p><Button variant="outline" className="mt-3" onClick={() => setRetry((v) => v + 1)}>Tentar novamente</Button></div> : !slots.length ? <p className="py-4 text-sm text-slate-500">Sem horários livres nesse dia. Escolha outra data.</p> : <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{slots.map((item) => <button type="button" key={item.start_time} aria-pressed={slot?.start_time === item.start_time} onClick={() => setSlot(item)} className={'min-h-12 rounded-xl border text-sm font-bold ' + (slot?.start_time === item.start_time ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200')}>{item.start_time}</button>)}</div>}
        </div>}
      </section>}
      <p className="mt-8 text-center text-xs text-slate-500">Agendamento por ClickAgenda</p>
    </div>
    {slot && <div className="booking-bottom fixed inset-x-0 bottom-0 z-30 border-t border-emerald-100 bg-white/95 px-4 pt-3 backdrop-blur-xl"><div className="mx-auto flex max-w-xl items-center gap-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{service.name}</p><p className="mt-1 text-xs text-slate-500">{displayDate(date)} às {slot.start_time}</p><p className="mt-1 text-sm font-bold text-emerald-800">{money(service.price)}</p></div><Button onClick={() => { setDialog(true); setFormError(''); }} className="h-12 shrink-0 rounded-xl bg-emerald-600 px-5 hover:bg-emerald-700">Continuar<ArrowRight className="ml-2 h-4 w-4" /></Button></div></div>}
    <Dialog open={dialog} onOpenChange={(value) => !booking && setDialog(value)}><DialogContent className="rounded-3xl sm:max-w-md" onOpenAutoFocus={(event) => event.preventDefault()}>
      <DialogHeader className="pr-8 text-left"><DialogTitle className="text-2xl">Só falta se identificar</DialogTitle><DialogDescription>3 · Seus dados. {contact ? 'Depois da reserva, abrimos o WhatsApp do profissional.' : 'Sua reserva ficará salva na agenda do profissional.'}</DialogDescription></DialogHeader>
      <form onSubmit={book} className="space-y-4">
        <div className="rounded-xl bg-emerald-50 p-3 text-sm"><strong className="block break-words">{service?.name}</strong><span className="text-emerald-800">{displayDate(date)} às {slot?.start_time} · {money(service?.price)}</span></div>
        <div className="space-y-2"><Label htmlFor="booking-name">Seu nome</Label><Input id="booking-name" autoComplete="name" required minLength={2} maxLength={100} value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} placeholder="Como você se chama?" className="h-12 rounded-xl" /></div>
        <div className="space-y-2"><Label htmlFor="booking-phone">Seu WhatsApp com DDD</Label><Input id="booking-phone" type="tel" inputMode="tel" autoComplete="tel-national" required value={client.phone} onChange={(e) => setClient({ ...client, phone: formatPhone(e.target.value) })} placeholder="(11) 9XXXX-XXXX" className="h-12 rounded-xl" aria-describedby="phone-help" /><p id="phone-help" className="text-xs text-slate-500">Use seu número real para o profissional falar com você.</p></div>
        <details><summary className="cursor-pointer py-2 text-sm text-slate-500">Adicionar e-mail (opcional)</summary><Label htmlFor="booking-email" className="sr-only">E-mail</Label><Input id="booking-email" type="email" autoComplete="email" maxLength={254} value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} placeholder="seu@email.com" className="h-12 rounded-xl" /></details>
        {formError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
        <Button type="submit" disabled={booking} className="h-14 w-full rounded-xl bg-emerald-600 hover:bg-emerald-700"><MessageCircle className="mr-2 h-5 w-5" />{booking ? 'Salvando sua reserva…' : contact ? 'Reservar e abrir WhatsApp' : 'Confirmar reserva'}</Button>
        <button type="button" disabled={booking} onClick={() => setDialog(false)} className="min-h-11 w-full text-sm text-slate-500">Revisar horário</button>
      </form>
    </DialogContent></Dialog>
  </main>;
}
