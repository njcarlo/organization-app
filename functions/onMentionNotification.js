import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './admin.js';
import { REGION } from './config.js';
import { resendApiKey } from './secrets.js';

const TRACKER_URL = 'https://tracker-hae.web.app';

function deepLink(data) {
  if (data.deepLink) return data.deepLink;
  if (data.parentType === 'projects' && data.programId) {
    return `${TRACKER_URL}/programs/${data.programId}`;
  }
  if (data.parentId) {
    return `${TRACKER_URL}/my-tasks?task=${encodeURIComponent(data.parentId)}`;
  }
  return `${TRACKER_URL}/notifications`;
}

async function resolveRecipientEmail(data) {
  const direct = String(data.userEmail || '')
    .trim()
    .toLowerCase();
  if (direct.includes('@')) return direct;
  if (!data.userId) return null;
  const snap = await db.collection('users').doc(data.userId).get();
  const email = String(snap.data()?.email || '')
    .trim()
    .toLowerCase();
  return email.includes('@') ? email : null;
}

async function sendViaResend({ apiKey, to, subject, text }) {
  const from =
    process.env.MENTION_EMAIL_FROM || 'HAE Tracker <onboarding@resend.dev>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.message || `Resend HTTP ${res.status}`);
  }
  return body;
}

/**
 * When PR #75 writes a `notifications` doc for an @mention, email the
 * mentioned user (Blaze + RESEND_API_KEY required). No-ops cleanly if the
 * secret is missing or the recipient has no email.
 */
export const onMentionNotificationCreated = onDocumentCreated(
  {
    document: 'notifications/{notificationId}',
    region: REGION,
    secrets: [resendApiKey],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data() || {};
    if (data.type !== 'mention') return;
    if (data.emailRequested === false) {
      await snap.ref.set(
        {
          emailSkipped: true,
          emailSkipReason: 'emailRequested=false',
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }
    if (data.emailSentAt || data.emailSkipped) return;

    const apiKey = resendApiKey.value();
    if (!apiKey) {
      await snap.ref.set(
        {
          emailSkipped: true,
          emailSkipReason: 'RESEND_API_KEY not configured',
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }

    const to = await resolveRecipientEmail(data);
    if (!to) {
      await snap.ref.set(
        {
          emailSkipped: true,
          emailSkipReason: 'recipient has no email',
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }

    const fromName = data.fromName || 'Someone';
    const parentName = data.parentName || 'a task';
    const link = deepLink(data);
    const subject = `${fromName} mentioned you on ${parentName}`;
    const text = [
      `${fromName} mentioned you on the HAE platform.`,
      '',
      `On: ${parentName}`,
      data.commentText ? `Comment: "${data.commentText}"` : '',
      '',
      `Open: ${link}`,
      '',
      '— HAE',
    ]
      .filter((line) => line !== undefined)
      .join('\n');

    try {
      const result = await sendViaResend({ apiKey, to, subject, text });
      await snap.ref.set(
        {
          userEmail: to,
          emailSentAt: FieldValue.serverTimestamp(),
          emailProvider: 'resend',
          emailId: result?.id || null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error('mention email failed', err);
      await snap.ref.set(
        {
          emailError: err?.message || String(err),
          emailFailedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  }
);
