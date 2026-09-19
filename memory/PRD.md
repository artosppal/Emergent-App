# Notifin — Product Requirements (PRD)

## Original Problem Statement
Notifin — aplikasi pelacak langganan (subscription tracker) untuk pasar Indonesia. Membantu orang tidak lupa cancel trial gratis & tidak boncos karena langganan menumpuk. Freemium (gratis: max 3 langganan + push; premium: unlimited + WhatsApp + Family Sharing). Dibangun bertahap FASE 1-4. Akan di-build jadi APK Android.

Tagline: "Biar gak ada lagi langganan yang kelewat atau lupa di-cancel."

## Architecture
- Frontend: Expo (SDK 54) + expo-router, React Native. Plus Jakarta Sans (static instances generated from variable font via fonttools). MaterialCommunityIcons.
- Backend: FastAPI + MongoDB (motor). JWT (bcrypt) auth + Google OAuth (direct PKCE). httpx for Expo Push Notification Service.
- Design: "Tactile / Playful LIGHT", brand green #059669. Bottom tabs (Beranda / Langganan / Akun). Glass headers + tab bar.

## User Personas
- Anak muda / dewasa muda Indonesia melek digital dengan banyak langganan digital.
- Keluarga/teman kecil yang berbagi langganan (Fase 2).

## Core Requirements (static)
- Auth (email/password + Google)
- CRUD langganan + filter kategori/status
- Dashboard (total bulan ini, proyeksi, jatuh tempo 7 hari, chart per kategori)
- Freemium gating (max 3, upgrade modal)
- Reminder H-3/H-1/H-0

## Implemented (2026-06)
### FASE 1 — MVP ✅ (done 2026-06)
- JWT email/password auth (register/login) + Emergent Google OAuth. AuthContext + root gate.
- Subscription CRUD (name, category, price, cycle, next_due_date, status trial/paid, reminders, notes). Soft delete.
- Filter by category (horizontal chip scroller) + status.
- Dashboard: total monthly (normalized), projection, upcoming (7 days), spend-by-category bar chart. Empty states.
- Freemium gating: backend enforces 3-active limit (403 limit_reached); frontend UpgradeSheet (@gorhom/bottom-sheet). Mock upgrade/downgrade endpoints.
- Push: /api/register-push + send_push relay (Emergent managed). Local scheduled reminders H-3/H-1/H-0 per subscription (expo-notifications). Tap handlers + Android channel in _layout.
- Notification channel settings in Akun (push always; WhatsApp locked behind premium).
- Toast system (no Alerts). Keyboard handling via react-native-keyboard-controller.

### FASE 2 — Family/Team Sharing ✅ (done 2026-06)
- Groups: create (premium-only, 403 premium_required), join via 6-char invite code (case-insensitive), leave (owner blocked), delete (owner-only, cascades subs).
- Shared subs (owner/koordinator-only CRUD): equal or custom split per member. Payments keyed per next_due_date period; due dates auto-advance past today → paid statuses reset automatically each period.
- Pay status: member toggles self, owner toggles anyone. Coordinator "unpaid members" overview in group detail.
- UI: "Grup" tab (list + create/join modals), /group/[id] detail (invite code + Share, members, split rows w/ tap-to-toggle paid), /group/add-sub form.
- Service presets (src/constants/presets.ts, 16 popular ID services w/ common prices): quick-pick chips in personal sub form + group sub form.
- "Sorotan boros" on dashboard: most_expensive (monthly-normalized) + ending_trials (trials due 0–14 days).
- Backend tests: /app/backend/tests/test_notifin_groups.py (run with `pytest -n 0`, serial).

### FASE 3 — WhatsApp + Nudge + Riwayat ✅ (done 2026-06)
- WhatsApp via Fonnte (playbook): send_whatsapp() with SIMULATION MODE while FONNTE_TOKEN (backend/.env) empty — messages recorded in db.wa_outbox status=simulated. To go live: fill FONNTE_TOKEN + restart backend.
- Phone: PUT /api/auth/phone (normalizes 08xx/+62 → 62-digits, 422 invalid, empty clears). public_user has phone + wa_live. Akun screen: phone row + modal, "Mode simulasi" banner when WA on & !wa_live.
- Scheduler: asyncio loop (30 min) reminder_sweep(): personal subs → WA (premium + wa channel + phone, offsets from sub.reminders); group subs → push relay to unpaid members + WA to eligible members at H-3/H-1/H-0. Idempotent via db.notif_log unique keys.
- Nudge: POST /groups/{gid}/subscriptions/{sid}/nudge — owner-only, unpaid target, 1x/day (429), push + WA. UI "Ingatkan" pill on unpaid split rows.
- Riwayat: GET /groups/{gid}/history — up to 12 past periods (>= created_at) per sub, paid/unpaid splits. UI /group/history screen.
- Tests: /app/backend/tests/test_notifin_fase3.py (15) + groups suite; run `pytest -n 0`.

### Continuing via Claude Code (2026-09) — no longer Emergent's builder
- Payment gateway ✅ — Mayar.id (Membership API v2), not Midtrans/Xendit as the FASE 4 line below still says; ignore that mention. `/auth/upgrade` starts a real checkout, `/webhooks/mayar` is the only place `plan` actually flips.
- Onboarding survey ✅ — 4-question survey + tour, `POST /api/onboarding`.
- Pricing page ✅ (2026-09) — standalone `/pricing` (`frontend/app/pricing.tsx`), reachable logged-in or out. Logged-out: full marketing chrome + an 8-row feature comparison table + FAQ. Logged-in: lightweight header, plan cards reflect the visitor's actual plan (inert pill on their current plan, Premium CTA opens the real upgrade sheet instead of registration). Linked from Account ("Bandingkan semua fitur paket"). `Nav`/`Footer`/`SectionHeading` were pulled out of `LandingPage.tsx` into `src/components/landing/shared.tsx` so this page could reuse them.

## Backlog (next phases)
- Ringkasan pengeluaran mingguan/bulanan via email (already advertised in landing/pricing copy as a Premium feature — not yet implemented, build to match).
- Social share of monthly total.
- Referral program.
- Optional cleanup: @app.on_event → lifespan; shadow* → boxShadow.

## Pending user inputs / build notes
- Push migrated off the Emergent relay to Expo Push Notification Service (2026-09): `send_push()`/`/api/register-push` in `backend/server.py` now store the device token in `db.push_tokens` and POST straight to `https://exp.host/--/api/v2/push/send`, no API key needed. Client (`AuthContext.tsx`) calls `Notifications.getExpoPushTokenAsync({ projectId })` instead of `getDevicePushTokenAsync()` — this needs an EAS project id in `app.json` (`extra.eas.projectId`) to return a real token; until an EAS project exists it fails closed (caught, non-blocking) same as before.
- FONNTE_TOKEN (backend/.env) empty → WA simulation mode. User will provide token later.

## Next Tasks
- Next backlog item per user priority: weekly/monthly spending summary email, then social share, then referral program.
