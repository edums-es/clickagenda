const DDDS = new Set('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' '));

export function normalizeMobile(value = '') {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) digits = digits.slice(2);
  if (/[^0-9+().\s-]/.test(value) || digits.length !== 11 || !DDDS.has(digits.slice(0, 2)) || digits[2] !== '9') return null;
  const subscriber = digits.slice(3);
  if (new Set(subscriber).size === 1 || ['12345678', '87654321', '01234567'].includes(subscriber)) return null;
  return `55${digits}`;
}

export function formatPhone(value = '') {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (digits.length < 3) return digits;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}${digits.length > 7 ? '-' + digits.slice(7) : ''}`;
}

export const displayDate = (date = '') => /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split('-').reverse().join('/') : date;

export function socialUrl(platform, value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();
  const bases = { instagram: 'https://instagram.com/', facebook: 'https://facebook.com/', tiktok: 'https://www.tiktok.com/@', youtube: 'https://youtube.com/@' };
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : bases[platform] ? bases[platform] + encodeURIComponent(text.replace(/^@/, '')) : 'https://' + text);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function whatsappLink(phone, message = '') {
  const number = normalizeMobile(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null;
}

export function bookingWhatsApp(booking, professional) {
  return whatsappLink(professional.phone, `Olá, ${professional.business_name || professional.name}! Sou ${booking.client_name}. Agendei pelo ClickAgenda:\nServiço: ${booking.service_name}\nData: ${displayDate(booking.date)}\nHorário: ${booking.start_time}\nCódigo: ${booking.appointment_id || ''}\nPodemos conversar sobre meu atendimento?`);
}

export function downloadCalendar(booking) {
  if (!booking.start_at || !booking.end_at) return;
  const stamp = (date) => new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const escape = (value) => String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ClickAgenda//Agendamento//PT-BR', 'BEGIN:VEVENT', `UID:${escape(booking.appointment_id)}@clickagenda`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(booking.start_at)}`, `DTEND:${stamp(booking.end_at)}`, `SUMMARY:${escape(booking.service_name)}`, 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'meu-agendamento.ics';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
