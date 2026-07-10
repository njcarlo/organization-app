import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { assertExecInboxAllowed } from './execInboxAllowlist.js';
import { runSync } from './syncCore.js';
import { googleOauthClientId, googleOauthClientSecret, anthropicApiKey } from './secrets.js';
import { REGION } from './config.js';
import { db } from './admin.js';
import { FieldValue } from 'firebase-admin/firestore';

export const execInboxSyncNow = onCall(
  {
    region: REGION,
    secrets: [googleOauthClientId, googleOauthClientSecret, anthropicApiKey],
    timeoutSeconds: 300,
  },
  async (request) => {
    try {
      assertExecInboxAllowed(request.auth?.token);
    } catch {
      throw new HttpsError('permission-denied', 'Not authorized for Executive Inbox.');
    }

    try {
      return await runSync({
        clientId: googleOauthClientId.value(),
        clientSecret: googleOauthClientSecret.value(),
        anthropicApiKey: anthropicApiKey.value(),
      });
    } catch (err) {
      await db.collection('execInboxStatus').doc('singleton').set(
        { lastSyncError: err.message || String(err), lastSyncErrorAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      throw new HttpsError('internal', err.message || 'Sync failed.');
    }
  }
);
