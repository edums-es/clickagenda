# Booking experience — release status (2026-09-17)

## Implemented

- One public booking flow for `/p/:slug` and `/p/:slug/agendar`.
- Service photo upload, full description, readable cards and a seven-day mobile picker.
- Brazilian mobile normalization/DDD validation; rejects obvious repeated/sequential placeholders. This does **not** verify ownership or WhatsApp registration. OTP is a separate capability, not implemented.
- Server rechecks opening hours, breaks, lead time and availability before booking; database exclusion prevents simultaneous overlap. UUID retry keys return the original booking.
- Save reservation before redirecting to `wa.me`; persistent receipt and explicit retry button. The customer must send the prefilled message. No WhatsApp API messages are sent.
- Durable, owner-scoped notifications for new reservations/status changes, polled every ten seconds while visible. No background push notifications are claimed.
- Professional bottom navigation, shrinkable content, mobile dashboard cards, scrollable dialogs and safe-area padding.
- Weekday numbering matches PostgreSQL (Sunday=0), including onboarding.
- Same-origin Vercel API proxy keeps session cookies first-party. Must be released together with the Supabase backend, not independently against the legacy API.
  Reference: https://vercel.com/docs/routing/rewrites

## Verified

- Frontend production build.
- 11 frontend regression cases and 8 backend unit cases.
- `python smoke_booking.py --allow-test-fixture`: actual Supabase login/session, image upload, service persistence, availability, invalid phone rejection, booking, retry idempotency, concurrent conflict, client creation, notification/read state, cancellation and slot release.
- Smoke test only creates a unique `qa-booking-*` account; its image and related data are removed in `finally`. It never messages a phone or emails a user.
- Public booking/receipt inspected at 390px and 320px; no page-wide horizontal overflow in inspected states. Authenticated professional mobile screens still need online end-to-end verification after coordinated release.
- Migration `0003_booking_experience.sql` applied to `zuvpjwosdtfhfqwjcmzl`. Restored schema lacked `services.category`; migration adds it idempotently. No existing booking rows were changed.

## Production blocker — do not declare this online yet

- Railway service `47502e86-bdf2-4d53-8ad6-4384bcb2eb2c`, project `c64fe6a5-e5ee-457a-a466-c3b4a4c25d90`, workspace `Drop Box's Projects`.
- Source verified: `edums-es/clickagenda`, branch `main`, root `/backend`, auto-deploy enabled.
- Dashboard explicitly reports unpaid subscription, expired trial and limited deploy access. Active deployment still says `fix: restore original auth logic and fields to redesigned pages` from two months ago.
- Public API `/api/` still identifies itself as `SalãoZap API` v1.0.0, not the current Supabase core.
- Railway Variables currently lists only APP_ENV, CORS_ORIGINS, DB_NAME, JWT_SECRET and MONGO_URL. Supabase credentials are not configured there. Values were not revealed or copied.
- Keep this release on a Git branch until backend access is restored or a hosting migration is authorized. Updating only the production frontend would leave a mismatched API.

## Coordinated release checklist

1. Account owner regularizes Railway billing, or authorizes another API host.
2. Check production variables against `backend/.env.example`, especially Supabase service key, APP_ENV, CORS_ORIGINS, FRONTEND_URL, SUPERADMIN_EMAILS and integration vault encryption key. Never commit credentials.
3. Reconcile legacy live data with Supabase before switching; do not discard existing users/bookings. The passing test of a new fixture does not prove old production data is migrated.
4. Verify/apply remaining migrations (billing migration 0002 was not part of this booking change).
5. Deploy backend, verify `/health` and `/api/` identify Supabase. Deploy frontend from the same release.
6. Test production sign-in, professional upload, public reservation/WhatsApp navigation, notification delivery, cancellation, and authenticated mobile routes. Verify no unexpected rate-limit/cookie issues through the proxy.

## Known follow-up

- Phone ownership verification/anti-spam challenges and push notifications when closed require separate integration.
- Rate limiter is process-local; shared storage is needed before scaling replicas. Monitor forwarded client identity when using the proxy.
- Legacy client phone values without country code may need a reviewed data normalization migration to prevent duplicated contacts.
- Availability updates currently replace rules in separate requests; use a database transaction/RPC before more complex schedule editing.
