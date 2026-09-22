import unittest
from datetime import date, datetime
from zoneinfo import ZoneInfo
from dashboard_rules import dashboard_metrics


class DashboardTests(unittest.TestCase):
    now = datetime(2026, 9, 21, 14, 0, tzinfo=ZoneInfo('America/Sao_Paulo'))

    def row(self, day, time='09:00', status='scheduled', price=6990):
        return dict(appointment_date=day, start_time=time, status=status, service_price=price)

    def test_upcoming_sorted_excludes_cancelled_completed_and_past(self):
        rows = [self.row('2026-09-23'), self.row('2026-09-21', '16:00'),
                self.row('2026-09-21', '10:00'), self.row('2026-09-22', status='cancelled'),
                self.row('2026-09-22', status='completed')]
        result = dashboard_metrics(rows, self.now)
        self.assertEqual(result['upcoming_clients'], [rows[1], rows[0]])

    def test_range_does_not_hide_future_list_or_change_monthly_revenue(self):
        rows = [self.row('2026-09-01', status='completed'), self.row('2026-09-21'),
                self.row('2026-09-23'), self.row('2026-08-20', status='completed')]
        result = dashboard_metrics(rows, self.now, date(2026, 9, 20), date(2026, 9, 21))
        self.assertEqual(result['recent_appointments'], [rows[1]])
        self.assertEqual(result['upcoming_clients'], [rows[2]])
        self.assertEqual(result['monthly_revenue'], 69.9)
        self.assertEqual(result['confirmation_rate'], 50)

    def test_rate_uses_last_30_days_not_future_or_cancelled(self):
        rows = [self.row('2026-09-21', status='confirmed'), self.row('2026-09-20'),
                self.row('2026-09-23', status='confirmed'), self.row('2026-09-20', status='cancelled'),
                self.row('2026-08-01')]
        self.assertEqual(dashboard_metrics(rows, self.now)['confirmation_rate'], 50)

    def test_empty_metrics_and_bounded_lists(self):
        self.assertEqual(dashboard_metrics([], self.now)['confirmation_rate'], 0)
        self.assertEqual(len(dashboard_metrics([self.row('2026-09-23')] * 10, self.now)['upcoming_clients']), 5)


if __name__ == '__main__':
    unittest.main()
