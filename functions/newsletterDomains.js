export const NEWSLETTER_SENDER_DOMAINS = [
  'mailchimp.com',
  'mailchimpapp.net',
  'sendgrid.net',
  'substack.com',
  'mailgun.org',
  'constantcontact.com',
  'hubspotemail.net',
  'campaign-archive.com',
  'sparkpostmail.com',
  'convertkit.com',
  'klaviyomail.com',
];

const NEWSLETTER_LABELS = new Set(['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_FORUMS']);

export function extractHeader(headers, name) {
  const header = (headers || []).find((h) => h.name.toLowerCase() === name.toLowerCase());
  return header?.value || '';
}

export function extractEmailAddress(fromHeader) {
  const match = fromHeader.match(/<([^>]+)>/);
  return (match ? match[1] : fromHeader).trim().toLowerCase();
}

export function looksLikeNewsletter({ labelIds, headers }) {
  if ((labelIds || []).some((label) => NEWSLETTER_LABELS.has(label))) return true;
  if (extractHeader(headers, 'List-Unsubscribe')) return true;

  const fromEmail = extractEmailAddress(extractHeader(headers, 'From'));
  const domain = fromEmail.split('@')[1] || '';
  if (NEWSLETTER_SENDER_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) return true;

  return false;
}
