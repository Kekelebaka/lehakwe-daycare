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
    text = extractBody(raw);
  } catch {
    text = '[Could not extract email body]';
  }

  return { from: fromHeader, from_name: fromName || fromEmail, to: toHeader, subject, text };
}

/**
 * Extract the email body from raw MIME content.
 * Handles: multipart/alternative, multipart/mixed, simple text.
 */
function extractBody(raw: string): string {
  // First, split off headers from body
  const headerBodySplit = raw.indexOf('\r\n\r\n');
  const headerSection = headerBodySplit >= 0 ? raw.slice(0, headerBodySplit) : '';
  const bodySection = headerBodySplit >= 0 ? raw.slice(headerBodySplit + 4) : raw;

  // Check for multipart
  const contentType = headerSection.match(/content-type:\s*([^\s;]+)/i);
  const isMultipart = contentType && contentType[1].toLowerCase().startsWith('multipart');

  if (!isMultipart) {
    // Simple email — body is just text
    return cleanText(bodySection);
  }

  // Find boundary
  const boundaryMatch = headerSection.match(/boundary="?([^";\r\n]+)"?/i);
  if (!boundaryMatch) {
    return cleanText(bodySection);
  }

  const boundary = boundaryMatch[1];
  // Split by boundary — raw contains lines like "--boundary\r\n"
  const parts = bodySection.split(new RegExp(`--${escapeRegex(boundary)}`, 'i'));

  // Find best text part: prefer text/plain, fallback to text/html, fallback to first part
  let plainText = '';
  let htmlText = '';
  let anyText = '';

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === '--') continue;

    // Each part has its own headers + body
    const partSplit = trimmed.indexOf('\r\n\r\n');
    if (partSplit < 0) continue;

    const partHeaders = trimmed.slice(0, partSplit).toLowerCase();
    const partBody = trimmed.slice(partSplit + 4);

    // Skip MIME boundary markers
    if (partHeaders.startsWith('--') || partHeaders.includes('content-transfer-encoding: 7bit') && !partHeaders.includes('content-type')) continue;

    if (partHeaders.includes('text/plain')) {
      plainText = cleanText(partBody);
    } else if (partHeaders.includes('text/html')) {
      htmlText = stripHtml(partBody);
    } else if (!anyText) {
      anyText = cleanText(partBody);
    }
  }

  return plainText || htmlText || anyText || '[Empty email]';
}

/** Strip HTML tags and decode entities */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Clean up text content */
function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

/** Escape regex special chars */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
