import { Check, MessageCircle, CalendarDays, ArrowLeft, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { displayDate, downloadCalendar, bookingWhatsApp } from '@/lib/booking';

export default function BookingConfirmation({ booking, professional, onBack }) {
  const whatsapp = booking.whatsapp_url || bookingWhatsApp(booking, professional);
  const manageUrl = booking.token ? `${window.location.origin}/agendamento/${booking.token}` : null;
  return <main className="min-h-[100dvh] bg-[#f1f8f5] px-4 py-8 sm:py-16" data-testid="step-confirmation">
    <section className="mx-auto max-w-lg rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-soft sm:p-9">
      <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><Check className="h-7 w-7" /></div>
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Horário reservado</p>
      <h1 className="mt-2 text-3xl font-bold">Tudo certo, {booking.client_name?.split(' ')[0] || 'sua reserva está salva'}!</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-500">Sua reserva já está na agenda de {professional.business_name || professional.name}. {whatsapp ? 'Vamos abrir o WhatsApp com os detalhes. Toque em enviar na conversa.' : 'Guarde o link abaixo para consultar sua reserva.'}</p>
      <dl className="my-6 space-y-4 rounded-2xl bg-slate-50 p-5 text-sm">
        <div><dt className="text-slate-500">Serviço</dt><dd className="mt-1 break-words font-bold">{booking.service_name}</dd></div>
        <div className="grid grid-cols-2 gap-3"><div><dt className="text-slate-500">Data</dt><dd className="mt-1 font-bold">{displayDate(booking.date)}</dd></div><div><dt className="text-slate-500">Horário</dt><dd className="mt-1 font-bold">{booking.start_time}</dd></div></div>
      </dl>
      {whatsapp ? <Button asChild className="min-h-14 h-auto py-4 whitespace-normal w-full rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700"><a href={whatsapp} data-testid="booking-whatsapp"><MessageCircle className="mr-2 h-5 w-5 shrink-0" />Abrir WhatsApp do profissional</a></Button> : <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">O profissional ainda não cadastrou um WhatsApp válido. Sua reserva está salva mesmo assim.</p>}
      {whatsapp && <p className="mt-3 text-center text-xs leading-relaxed text-slate-500">Não abriu? Use o botão acima. Sua reserva não depende do envio da mensagem.</p>}
      <div className="mt-5 grid gap-2">
        {manageUrl && <Button asChild variant="outline" className="min-h-12 h-auto py-3 whitespace-normal rounded-xl"><a href={manageUrl}>Ver ou cancelar meu agendamento</a></Button>}
        {booking.start_at && <Button variant="outline" className="min-h-12 h-auto py-3 whitespace-normal rounded-xl" onClick={() => downloadCalendar(booking)}><CalendarDays className="mr-2 h-4 w-4" />Salvar no calendário</Button>}
        {manageUrl && <Button variant="ghost" className="min-h-12 h-auto py-3 whitespace-normal rounded-xl" onClick={async () => { try { await navigator.clipboard.writeText(manageUrl); toast.success('Link da reserva copiado'); } catch { toast.error('Não foi possível copiar. Abra o link da reserva.'); } }}><Copy className="mr-2 h-4 w-4" />Copiar link da reserva</Button>}
        <Button variant="ghost" className="min-h-12 h-auto py-3 whitespace-normal rounded-xl" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" />Voltar à página do profissional</Button>
      </div>
    </section>
  </main>;
}
