# Email OTP Registration

How `notifin.online` verifies a new account's email address before creating it, and how outbound mail is actually delivered.

## Flow

1. **`POST /api/auth/register`** — user submits name, email, password. No account is created yet. A 6-digit code is generated, hashed, and stored in the `otp_codes` collection (`purpose: "register_email"`, keyed by the lowercased email) along with the pending signup payload (name, email, `password_hash`). The code is emailed to the user.
2. **`POST /api/auth/register/verify`** — user submits the code. If it matches (and hasn't expired or been guessed wrong too many times), the pending payload becomes a real row in `users`, a session token is issued, and the OTP record is deleted.
3. **`POST /api/auth/register/resend`** — re-sends a fresh code for the same pending signup (45s cooldown, enforced in `create_otp`).

OTP rules (`backend/server.py`, top of the OTP section):
- `OTP_TTL_MINUTES = 10`
- `OTP_MAX_ATTEMPTS = 5` wrong guesses before the code is invalidated
- `OTP_RESEND_COOLDOWN_SECONDS = 45`

The same `otp_codes` collection and `create_otp`/`check_otp` helpers are reused for WhatsApp registration, WhatsApp login, and phone verification before Premium — `purpose` is what keeps them separate.

## Sending the email — Resend HTTPS API, not SMTP

`send_email()` in `backend/server.py` posts to `https://api.resend.com/emails` over HTTPS using `httpx`, authenticated with a bearer API key.

**This is deliberate — an earlier version used raw SMTP (`smtplib`, port 587) and it did not work on Railway.** Railway's outbound network silently drops SMTP port connections, so every registration attempt hung for ~2 minutes before timing out (`[Errno 110] Connection timed out` in the deploy logs) instead of failing fast. Switching to Resend's REST API over HTTPS (port 443, never blocked) fixed it outright. **Do not reintroduce SMTP for this app** — if email OTP needs to move providers again, keep it API/HTTPS-based.

If `RESEND_API_KEY` or `EMAIL_FROM` isn't set, `email_live()` returns `False` and the app falls back to **simulation mode**: the code is logged (`[EMAIL SIMULASI] -> ...`) instead of sent. This is intentional for local dev.

## Environment variables (Railway)

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | Resend API key (Dashboard → API Keys) |
| `EMAIL_FROM` | `noreply@notifin.online` (any address on the verified domain) |

The old `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` variables are no longer used and can be removed.

## Domain verification (Resend + Hostinger DNS)

`notifin.online` is verified in Resend (Domains → `notifin.online`, status "Verified"). Verification uses **subdomain CNAME records**, not a root-domain SPF/MX change — this matters because the domain already had an unrelated ImprovMX email-forwarding setup (MX + SPF at `@`) that this must not break.

Records added in Hostinger's DNS Zone Editor:

| Type | Name | Value | Purpose |
|---|---|---|---|
| TXT | `resend._domainkey` | (DKIM public key, from Resend's dashboard) | DKIM signing |
| CNAME | `rsend` | `rsend-apne1.forge.rmta.net` | Sending infra |
| CNAME | `send` | `send.forge.rmta.net` | Sending infra (SPF alignment) |
| TXT | `_dmarc` | `v=DMARC1; p=none;` | DMARC policy (report-only) |

"Enable Receiving" is left **off** in Resend — turning it on would add MX records that conflict with the existing ImprovMX forwarding setup. This app only sends mail, never receives it.

Pre-existing, unrelated DNS records on the same domain (don't touch these):
- `MX @ → mx1.improvmx.com` (10), `mx2.improvmx.com` (20)
- `TXT @ → "v=spf1 include:spf.improvmx.com ~all"`

## Troubleshooting

If a user reports registration hanging or never receiving the OTP email:

1. **Check Railway deploy logs first** (service → Deployments → View Logs) for `Email send failed: ...` around the time of the attempt.
   - A **timeout** error (`Connection timed out`) means something regressed back to a blocked network path — check that `send_email()` is still using the Resend HTTPS API, not SMTP.
   - An **auth/4xx** error from Resend usually means `RESEND_API_KEY` is missing, revoked, or the domain isn't verified.
2. If there are no error logs at all, `email_live()` may be returning `False` (missing env var) — the OTP was logged, not sent. Check the `[EMAIL SIMULASI]` log line.
3. Domain verification is stable once done — it doesn't need re-checking unless DNS records at Hostinger were changed.

## Related files

- `backend/server.py` — `send_email`, `email_live`, `create_otp`/`check_otp`, `/auth/register*` routes
- `frontend/app/(auth)/login.tsx` — registration UI, OTP entry screen
