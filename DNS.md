# DNS Records for lehakwedaycare.co.za

## Required Records

### 1. Cloudflare Pages (Website)
Created automatically when you add the custom domain in Cloudflare Pages.

| Type | Name | Content |
|------|------|---------|
| CNAME | lehakwedaycare.co.za | lehakwe-daycare.pages.dev |
| CNAME | www | lehakwe-daycare.pages.dev |

### 2. Cloudflare Pages (Inbox)
| Type | Name | Content |
|------|------|---------|
| CNAME | mail | lehakwe-inbox.pages.dev |

### 3. Email Routing (MX)
Set up automatically when you enable Email Routing in Cloudflare.
Cloudflare will provide the MX records.

### 4. SPF (Email Service)
From Cloudflare Email Service dashboard:
```
TXT  @  v=spf1 include:_spf.mx.cloudflare.net ~all
```

### 5. DKIM (Email Service)
From Cloudflare Email Service dashboard:
```
CNAME  <selector>._domainkey  <selector>._domainkey.lehakwedaycare.co.za.dkim.cloudflare.net
```

### 6. DMARC (Starter Policy)
```
TXT  _dmarc  v=DMARC1; p=none; rua=mailto:info@lehakwedaycare.co.za
```

## Setup Order
1. Deploy Pages projects first
2. Add custom domains in Pages dashboard
3. Enable Email Routing
4. Enable Email Service
5. Add SPF/DKIM/DMARC from Email Service dashboard
