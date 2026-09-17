import { normalizeMobile, formatPhone, displayDate, bookingWhatsApp } from './booking';

test.each(['27999999999', '11912345678', '11987654321', '00984567231', '1132456723', '119845672310', 'abc11984567231'])('rejects invalid or obviously fictitious phone %s', phone => {
  expect(normalizeMobile(phone)).toBeNull();
});
test.each(['11984567231', '(11) 98456-7231', '+55 (11) 98456-7231'])('normalizes Brazilian mobile %s', phone => {
  expect(normalizeMobile(phone)).toBe('5511984567231');
});
test('formats country code, local date and WhatsApp receipt', () => {
  expect(formatPhone('+55 (11) 98456-7231')).toBe('(11) 98456-7231');
  expect(displayDate('2026-09-21')).toBe('21/09/2026');
  const link = bookingWhatsApp({ client_name:'Cliente Teste', service_name:'Corte & barba', date:'2026-09-21', start_time:'10:30', appointment_id:'apt_test' }, { name:'Studio', phone:'11984567231' });
  expect(link).toMatch(/^https:\/\/wa.me\/5511984567231\?text=/);
  expect(decodeURIComponent(link)).toContain('21/09/2026');
  expect(decodeURIComponent(link)).toContain('Corte & barba');
});
