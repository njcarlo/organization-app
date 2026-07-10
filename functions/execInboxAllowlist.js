export const EXEC_INBOX_EMAILS = ['rmarchadesch@harvardae.org', 'rryan@harvardae.org'];

export function assertExecInboxAllowed(authToken) {
  const email = (authToken?.email || '').toLowerCase();
  if (!EXEC_INBOX_EMAILS.includes(email)) {
    throw new Error('not-allowed');
  }
  return email;
}
