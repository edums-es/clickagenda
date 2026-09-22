"""Pure dashboard calculations, with dates in the professional's timezone."""
from datetime import timedelta


def dashboard_metrics(rows, now, start_date=None, end_date=None):
    today = now.date()
    start = start_date or today.replace(day=1)
    end = end_date or today
    active = [r for r in rows if r['status'] not in ('cancelled', 'no_show')]
    day = lambda r: str(r['appointment_date'])
    order = lambda r: (day(r), str(r['start_time']))
    recent = [r for r in active if start.isoformat() <= day(r) <= end.isoformat()]
    upcoming = [r for r in active if r['status'] != 'completed' and
                (day(r), str(r['start_time'])[:5]) >= (today.isoformat(), now.strftime('%H:%M'))]
    last30 = [r for r in rows if r['status'] != 'cancelled' and
              (today - timedelta(days=29)).isoformat() <= day(r) <= today.isoformat()]
    confirmed = sum(r['status'] in ('confirmed', 'arrived', 'in_progress', 'completed') for r in last30)
    revenue = sum((r.get('service_price') or 0) / 100 for r in active
                  if r['status'] == 'completed' and day(r).startswith(today.isoformat()[:7]))
    return {
        'appointments_today': sum(day(r) == today.isoformat() for r in active),
        'total_appointments': len(active),
        'monthly_revenue': round(revenue, 2),
        'pending_confirmations': sum(r['status'] == 'scheduled' for r in active),
        'confirmation_rate': round(100 * confirmed / len(last30), 1) if last30 else 0,
        'recent_appointments': sorted(recent, key=order, reverse=True)[:5],
        'upcoming_clients': sorted(upcoming, key=order)[:5],
    }
