"""Offline regression tests: no live appointments or messages are created."""
import unittest
import uuid
from unittest.mock import patch, MagicMock
from types import SimpleNamespace
import server
import supabase_core as core
from booking_rules import brazil_mobile, whatsapp_url
from fastapi import HTTPException
from pydantic import ValidationError


class BookingTests(unittest.TestCase):
    def payload(self, **changes):
        return core.Appointment(**dict(service_id='svc_test', client_name='Cliente Teste', client_phone='11984567231', date='2099-01-05', start_time='10:00', **changes))

    def test_phone_normalization(self):
        for value in ['11984567231', '(11) 98456-7231', '+55 (11) 98456-7231']:
            self.assertEqual(brazil_mobile(value), '5511984567231')

    def test_reject_generic_numbers(self):
        for value in ['27999999999', '11912345678', '11987654321', '00984567231', '1132456723', 'abc11984567231']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                brazil_mobile(value)

    def test_models_reject_invalid_phone(self):
        with self.assertRaises(ValidationError):
            core.Appointment(service_id='s', client_name='Teste', client_phone='27999999999', date='2099-01-01', start_time='10:00')
        with self.assertRaises(ValidationError):
            core.Service(name='Corte', duration_minutes=0)
        with self.assertRaises(ValidationError):
            core.Service(name='Corte', image_url='javascript:alert(1)')

    def test_whatsapp_is_encoded_not_sent(self):
        self.assertIn('Ol%C3%A1%20%26%20teste', whatsapp_url('11984567231', 'Olá & teste'))
        self.assertIsNone(whatsapp_url('27999999999', 'Oi'))

    def test_unavailable_slot_rejected_before_any_client_insert(self):
        db = MagicMock()
        db.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value.data = {'id':'service', 'duration_minutes':60}
        with patch.object(core, 'supabase', db), patch.object(core, 'public_profile', return_value={'id':'owner'}), patch.object(core, 'enforce_plan_limit'), patch.object(core, 'public_slots', return_value={'slots':[]}):
            with self.assertRaises(HTTPException) as result:
                core.public_book('studio', self.payload())
            self.assertEqual(result.exception.status_code, 409)
            db.table.return_value.insert.assert_not_called()

    def test_retry_returns_original_without_insert(self):
        with patch.object(core, 'public_profile', return_value={'id':'owner'}), patch.object(core, 'retry_booking', return_value={'id':'original'}), patch.object(core, 'booking_confirmation', return_value={'appointment_id':'original'}), patch.object(core, 'enforce_plan_limit') as limit:
            self.assertEqual(core.public_book('studio', self.payload()), {'appointment_id':'original'})
            limit.assert_not_called()

    def test_notification_access_scoped_to_owner(self):
        db = MagicMock()
        db.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = []
        db.table.return_value.select.return_value.eq.return_value.is_.return_value.execute.return_value.count = 0
        with patch.object(core, 'supabase', db):
            self.assertEqual(core.notifications({'id':'owner'}), {'items':[], 'unread_count':0})
            for call in db.table.return_value.select.return_value.eq.call_args_list:
                self.assertEqual(call.args, ('professional_id', 'owner'))

    def test_notification_read_scoped_and_bounded(self):
        db = MagicMock()
        with patch.object(core, 'supabase', db):
            core.read_notifications(core.ReadNotifications(ids=[uuid.uuid4()]), {'id':'owner'})
            db.table.return_value.update.return_value.eq.assert_called_once_with('professional_id', 'owner')
        with self.assertRaises(ValidationError):
            core.ReadNotifications(ids=[uuid.uuid4() for _ in range(51)])


if __name__ == '__main__':
    unittest.main()
