import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { displayDate } from '@/lib/booking';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function NotificationCenter() {
  const [feed, setFeed] = useState({ items: [], unread_count: 0 });
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const seen = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    let alive = true;
    let pending = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (document.hidden || pending) return;
      pending = true;
      try {
        const { data } = await api.get('/notifications', { signal: controller.signal, silent: true });
        if (!alive) return;
        const fresh = seen.current ? data.items.filter(item => !seen.current.has(item.id)) : [];
        if (fresh.length) {
          toast.success(fresh.some(item => item.kind === 'booking_created') ? 'Novo agendamento na sua agenda' : 'Agendamento atualizado', { description: 'Abra os avisos para ver os detalhes.' });
          window.dispatchEvent(new Event('clickagenda:appointments-changed'));
        }
        seen.current = new Set(data.items.map(item => item.id));
        setFeed(data); setFailed(false);
      } catch (error) { if (alive && error.code !== 'ERR_CANCELED') setFailed(true); }
      finally { pending = false; }
    };
    refresh();
    const interval = setInterval(refresh, 10000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => { alive = false; controller.abort(); clearInterval(interval); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh); };
  }, []);
  const read = async (items) => {
    const ids = items.filter(item => !item.read_at).map(item => item.id);
    if (!ids.length) return;
    try {
      await api.post('/notifications/read', { ids });
      setFeed(previous => ({ items: previous.items.map(item => ids.includes(item.id) ? { ...item, read_at: new Date().toISOString() } : item), unread_count: Math.max(0, previous.unread_count - ids.length) }));
    } catch { toast.error('Não foi possível marcar os avisos como lidos.'); }
  };
  return <>
    <Button variant="outline" className="relative h-11 gap-2 rounded-xl" aria-label={`Avisos: ${feed.unread_count} não lidos${failed ? ', conexão indisponível' : ''}`} onClick={() => setOpen(true)}>
      <Bell className="h-5 w-5" /><span className="hidden sm:inline">Avisos</span>
      {feed.unread_count > 0 && <span className="rounded-full bg-emerald-700 px-1.5 text-xs text-white">{feed.unread_count > 99 ? '99+' : feed.unread_count}</span>}
      {failed && <span className="h-2 w-2 rounded-full bg-amber-500" />}
    </Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>Atividade da sua agenda</DialogTitle><DialogDescription>Novas reservas e alterações. Atualização automática enquanto o painel está aberto.</DialogDescription></DialogHeader>
      {failed && <p role="status" className="text-sm text-amber-700">Não conseguimos atualizar os avisos. Tentaremos novamente automaticamente.</p>}
      {feed.items.length ? <><Button variant="outline" onClick={() => read(feed.items)}>Marcar os avisos exibidos como lidos</Button><div className="space-y-2">{feed.items.map(item => <button key={item.id} className={`w-full rounded-xl border p-3 text-left ${item.read_at ? '' : 'border-emerald-200 bg-emerald-50'}`} onClick={() => { read([item]); setOpen(false); navigate('/agenda?date=' + item.appointment_date); }}><span className="block text-xs font-semibold text-emerald-800">{item.kind === 'booking_created' ? 'Nova reserva' : item.kind === 'booking_cancelled' ? 'Reserva cancelada' : 'Status atualizado'}</span><strong className="mt-1 block break-words text-sm">{item.client_name}</strong><span className="block break-words text-sm">{item.service_name}</span><span className="mt-1 block text-xs text-muted-foreground">{displayDate(item.appointment_date)} às {item.start_time.slice(0,5)}</span></button>)}</div></> : !failed && <p className="py-8 text-center text-sm text-muted-foreground">Os próximos agendamentos aparecerão aqui.</p>}
    </DialogContent></Dialog>
  </>;
}
