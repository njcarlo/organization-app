import emailjs from '@emailjs/browser'

/**
 * Sends a "you were mentioned" email straight from the browser via EmailJS —
 * no Cloud Functions / Blaze plan required. Configure via Vite env vars:
 * VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY.
 * No-ops (and returns false) if any of those are unset.
 *
 * The EmailJS template should expect these variables: to_email, to_name,
 * from_name, parent_name, comment_text, link.
 */
export async function sendMentionEmail({ toEmail, toName, fromName, parentName, commentText, link }) {
  const serviceId = import.meta.env?.VITE_EMAILJS_SERVICE_ID
  const templateId = import.meta.env?.VITE_EMAILJS_TEMPLATE_ID
  const publicKey = import.meta.env?.VITE_EMAILJS_PUBLIC_KEY
  if (!serviceId || !templateId || !publicKey || !toEmail) return false

  try {
    await emailjs.send(
      serviceId,
      templateId,
      {
        to_email: toEmail,
        to_name: toName || 'there',
        from_name: fromName || 'Someone',
        parent_name: parentName || 'HAE',
        comment_text: commentText || '',
        link: link || '',
      },
      { publicKey }
    )
    return true
  } catch (err) {
    console.error('Mention email failed', err)
    return false
  }
}
