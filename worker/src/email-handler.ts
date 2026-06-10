import type { EmailMessage } from 'cloudflare:email';

/**
 * Parse the raw Cloudflare Email Workers `ForwardableEmailMessage`
 * into our structured email data.
 */
export async function parseIncomingEmail(message: {
  from: string;
  to: string;
  headers: Headers;
  raw: ReadableStream<Uint8Array>;
}): Promise<{ from: string; from_name: string; to: string; subject: string; text: string }> {
  const fromHeader = message.headers.get('from') || '';
  const toHeader = message.headers.get('to') || message.to;
  const subject = message.headers.get('subject') || '(no subject)';

  const fromMatch = fromHeader.match(/^"?([^"]*)"?\s*<(.+?)>$/);
  const fromName = fromMatch ? fromMatch[1].trim() : '';
  const fromEmail = fromMatch ? fromMatch[2].trim() : fromHeader.trim();

  // Read raw email body
  let text = '';
  try {
    const reader = message.raw.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const raw = new TextDecoder().decode(
      chunks.reduce((acc, c) => {
        const merged = new Uint8Array(acc.length + c.length);
        merged.set(acc, 0);
        merged.set(c, acc.length);
        return merged;
      }, new Uint8Array(0))
    );
    text = extractPlainText(raw);
  } catch {
    text = '[Could not extract email body]';
  }

  return { from: fromHeader, from_name: fromName || fromEmail, to: toHeader, subject, text };
}

/** Extract plain text from raw MIME email content */
function extractPlainText(raw: string): string {
  // Simple MIME parser: look for text/plain part
  const boundaryMatch = raw.match(/boundary="([^"]+)"/i);
  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = raw.split(`--${boundary}`);
    for (const part of parts) {
      if (part.includes('text/plain') && !part.includes('text/html')) {
        const bodyStart = part.indexOf('\n\n');
        if (bodyStart >= 0) {
          const body = part.slice(bodyStart + 2).trim();
          // Decode quoted-printable
          return decodeQuotedPrintable(body);
        }
      }
    }
    // Fallback: return the first part after headers
    for (const part of parts) {
      const bodyStart = part.indexOf('\n\n');
      if (bodyStart >= 0) {
        return part.slice(bodyStart + 2).trim();
      }
    }
  }
  // No MIME — try to find body after headers
  const bodyStart = raw.indexOf('\n\n');
  if (bodyStart >= 0) {
    return raw.slice(bodyStart + 2).trim();
  }
  return raw;
}

/** Basic quoted-printable decoder */
function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/** Build the forwarded email body for staff personal inboxes */
export function buildForwardBody(
  fromName: string, fromEmail: string, subject: string,
  body: string, receivedAt: string, threadId: string,
): string {
  return [
    'New enquiry received for Lehakwe Daycare.',
    '',
    `From: ${fromName} <${fromEmail}>`,
    `Subject: ${subject}`,
    `Received: ${receivedAt}`,
    '',
    '--- Message ---',
    '',
    body,
    '',
    '---',
    '',
    'To reply officially as Lehakwe Daycare, use:',
    `https://mail.lehakwedaycare.co.za/thread/${threadId}`,
    '',
    'Do not reply directly from your personal email if you want the reply to come from info@lehakwedaycare.co.za.',
  ].join('\n');
}

/** Build auto-reply text */
export function buildAutoReply(fromName: string): string {
  return [
    `Good day ${fromName || 'there'},`,
    '',
    'Thank you for contacting Lehakwe Daycare. We have received your message and will get back to you soon.',
    '',
    'If your enquiry is urgent, please call or message us on WhatsApp.',
    '',
    'Kind regards,',
    'Lehakwe Daycare',
    'info@lehakwedaycare.co.za',
    'www.lehakwedaycare.co.za',
  ].join('\n');
}

/** Apply staff signature to reply body */
export function applySignature(body: string, staffName: string): string {
  const signature = [
    '',
    'Kind regards,',
    '',
    staffName,
    'Lehakwe Daycare',
    'info@lehakwedaycare.co.za',
    'www.lehakwedaycare.co.za',
  ].join('\n');
  return (body.replace('[SIGNATURE]', signature).trim()) + '\n';
}

/** Build a raw RFC 5322 email message for reply() */
export function buildReplyRaw(fromAddr: string, fromName: string, toAddr: string, subject: string, body: string): ReadableStream<Uint8Array> {
  const mime = [
    `From: ${fromName} <${fromAddr}>`,
    `To: ${toAddr}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    body,
  ].join('\r\n');
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(mime));
      controller.close();
    },
  });
}
