# Lehakwe Daycare — Website + Email System

Built for [Lehakwe Daycare](https://lehakwedaycare.co.za) by ChiefOps AI.

## What's here

| Directory | Purpose |
|-----------|---------|
| `site/`   | Static one-page daycare website (Cloudflare Pages) |
| `worker/` | Cloudflare Worker — email intake, forwarding, API (Cloudflare Workers) |
| `inbox/`  | React staff inbox app (Cloudflare Pages — `mail.lehakwedaycare.co.za`) |
| `db/`     | D1 database schema (Cloudflare D1) |

## Architecture

```
Parent emails info@lehakwedaycare.co.za
       ↓
Cloudflare Email Routing → Email Worker
       ↓                    ↓
  Forward to staff       Save to D1
       ↓                    ↓
Staff personal inbox    Staff web inbox (mail.lehakwedaycare.co.za)
                              ↓
                         Reply from info@ (via Email Service)
                              ↓
                         Logged in audit_logs
```

## Setup

### Prerequisites

1. Cloudflare account with Workers Paid plan
2. Domain `lehakwedaycare.co.za` on Cloudflare DNS
3. Node.js 18+
4. Wrangler CLI (`npm i -g wrangler`)

### 1. Deploy Database

```bash
wrangler d1 create lehakwe-db
wrangler d1 execute lehakwe-db --file=./db/schema.sql
```

### 2. Configure Worker

Edit `worker/wrangler.toml`:
- Set `database_id` from `wrangler d1 list`
- Update `FORWARD_EMAILS` with actual staff emails
- Set `ALLOWED_ORIGIN` to production inbox URL

```bash
cd worker
npm install
wrangler deploy
```

### 3. Enable Email Routing

In Cloudflare Dashboard:
1. Enable Email Routing for `lehakwedaycare.co.za`
2. Create route: `info@lehakwedaycare.co.za` → Email Worker (`lehakwe-email-worker`)
3. Enable Email Service for outbound sending

### 4. Deploy Inbox

```bash
cd inbox
npm install
npm run build
wrangler pages deploy dist --project-name=lehakwe-inbox
```

### 5. Protect Inbox with Cloudflare Access

In Cloudflare Zero Trust:
1. Create an Application for `mail.lehakwedaycare.co.za`
2. Add policy: allow only staff email addresses
3. The inbox reads `Cf-Access-Authenticated-User-Email` header

### 6. Deploy Website

```bash
# From project root
wrangler pages deploy site --project-name=lehakwe-daycare
```

### 7. Configure DNS

Cloudflare Pages custom domains:
- `lehakwedaycare.co.za` → `lehakwe-daycare` Pages project
- `www.lehakwedaycare.co.za` → redirect to root
- `mail.lehakwedaycare.co.za` → `lehakwe-inbox` Pages project

Email DNS records (from Cloudflare Dashboard):
- SPF record
- DKIM record
- DMARC: `v=DMARC1; p=none; rua=mailto:info@lehakwedaycare.co.za`

## Client Handover

After deployment, share:
1. Website: https://lehakwedaycare.co.za
2. Staff inbox: https://mail.lehakwedaycare.co.za
3. Staff log in with their email (protected by Cloudflare Access)
4. Forwarded copies arrive in personal inboxes
5. Official replies ONLY from the web inbox
