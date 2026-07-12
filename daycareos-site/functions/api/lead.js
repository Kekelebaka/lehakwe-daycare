// Cloudflare Pages Function — POST /api/lead
// Receives a signup/interest submission from the Ubuntu Daycare OS site and emails
// it to info@ubuntutown.co.za. Same-origin (served from daycareos.ubuntutown.co.za),
// so no CORS needed. Requires the RESEND_API_KEY secret on the Pages project.
// Sends FROM the Resend-verified lehakwedaycare.co.za sender (same ChiefOps Resend
// account); reply-to is the lead's own email so replies go straight back to them.

const LEAD_INBOX = 'info@ubuntutown.co.za';
const FROM = 'Ubuntu Daycare OS <info@lehakwedaycare.co.za>';

const clean = (v, max = 200) => (v == null ? '' : String(v).replace(/[\r\n]+/g, ' ').trim().slice(0, max));

export async function onRequestPost(context) {
  const { request, env } = context;
  let d = {};
  try { d = await request.json(); } catch { /* ignore */ }

  const lead = {
    centre: clean(d.centre), name: clean(d.name), email: clean(d.email),
    phone: clean(d.phone), province: clean(d.province), children: clean(d.children),
    plan: clean(d.plan, 80),
  };

  if (!lead.centre && !lead.email && !lead.phone) {
    return Response.json({ ok: false, error: 'Please add your contact details.' }, { status: 400 });
  }

  const text =
    `New Ubuntu Daycare OS enquiry\n\n` +
    `Centre:    ${lead.centre || '—'}\n` +
    `Name:      ${lead.name || '—'}\n` +
    `Email:     ${lead.email || '—'}\n` +
    `Phone:     ${lead.phone || '—'}\n` +
    `Province:  ${lead.province || '—'}\n` +
    `Children:  ${lead.children || '—'}\n` +
    `Interest:  ${lead.plan || '—'}\n\n` +
    `Sent from daycareos.ubuntutown.co.za`;

  // Always log (visible in Pages function logs) as a fallback record of the lead.
  console.log('LEAD', JSON.stringify(lead));

  if (env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: [LEAD_INBOX],
          reply_to: lead.email || undefined,
          subject: `New lead: ${lead.centre || lead.name || 'Ubuntu Daycare OS enquiry'}`,
          text,
        }),
      });
      if (!res.ok) console.error('Resend failed', res.status);
    } catch (e) {
      console.error('Resend error', e);
    }
  } else {
    console.warn('RESEND_API_KEY not set — lead logged only, no email sent.');
  }

  // Always confirm to the visitor (their submission is recorded either way).
  return Response.json({ ok: true });
}

// Optional: gracefully handle non-POST probes.
export async function onRequestGet() {
  return Response.json({ ok: true, service: 'ubuntu-daycareos-lead', method: 'POST' });
}
