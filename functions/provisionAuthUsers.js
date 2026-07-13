import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, db } from './admin.js';
import { REGION } from './config.js';

const SUPER_ADMIN_EMAILS = [
  'njcarlo@gmail.com',
  'inahmarchadesch@gmail.com',
];

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function assertCallerIsAdmin(auth) {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  const email = normalizeEmail(auth.token?.email);
  if (SUPER_ADMIN_EMAILS.includes(email)) return;

  const snap = await db.collection('users').doc(auth.uid).get();
  const role = snap.data()?.role;
  if (role !== 'admin') {
    throw new HttpsError('permission-denied', 'Admin role required.');
  }
}

/**
 * Create (or reuse) Firebase Auth accounts for a list of emails and upsert
 * matching Firestore `users/{uid}` profiles. Does not set passwords —
 * callers should send password-reset emails afterward.
 *
 * Input: { emails: string[], role?: string, nameByEmail?: { [email]: string } }
 * Output: { results: [{ email, status, uid?, error? }] }
 */
export const provisionAuthUsers = onCall({ region: REGION }, async (request) => {
  await assertCallerIsAdmin(request.auth);

  const emailsRaw = Array.isArray(request.data?.emails)
    ? request.data.emails
    : [];
  const role = ['admin', 'staff', 'member', 'student'].includes(request.data?.role)
    ? request.data.role
    : 'staff';
  const nameByEmail = request.data?.nameByEmail || {};

  const emails = [
    ...new Set(emailsRaw.map(normalizeEmail).filter(isValidEmail)),
  ];
  if (emails.length === 0) {
    throw new HttpsError('invalid-argument', 'Provide at least one email.');
  }
  if (emails.length > 100) {
    throw new HttpsError('invalid-argument', 'Max 100 emails per request.');
  }

  const results = [];
  for (const email of emails) {
    try {
      let userRecord;
      let status = 'exists';
      try {
        userRecord = await adminAuth.getUserByEmail(email);
      } catch (err) {
        if (err?.code !== 'auth/user-not-found') throw err;
        const displayName =
          nameByEmail[email] ||
          nameByEmail[email.toLowerCase()] ||
          email.split('@')[0];
        userRecord = await adminAuth.createUser({
          email,
          displayName,
          emailVerified: false,
          disabled: false,
        });
        status = 'created';
      }

      const name =
        nameByEmail[email] ||
        nameByEmail[email.toLowerCase()] ||
        userRecord.displayName ||
        email.split('@')[0];

      await db.collection('users').doc(userRecord.uid).set(
        {
          email,
          name,
          role,
          updatedAt: FieldValue.serverTimestamp(),
          ...(status === 'created'
            ? { createdAt: FieldValue.serverTimestamp() }
            : {}),
        },
        { merge: true }
      );

      results.push({ email, status, uid: userRecord.uid });
    } catch (err) {
      results.push({
        email,
        status: 'error',
        error: err?.message || String(err),
      });
    }
  }

  return { results };
});
