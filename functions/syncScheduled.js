import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FieldValue } from 'firebase-admin/firestore';
import { runSync } from './syncCore.js';
import { googleOauthClientId, googleOauthClientSecret, anthropicApiKey } from './secrets.js';
import { REGION } from './config.js';
import { db } from './admin.js';

export const execInboxSyncScheduled = onSchedule(
  {
    region: REGION,
    schedule: 'every 15 minutes',
    secrets: [googleOauthClientId, googleOauthClientSecret, anthropicApiKey],
    timeoutSeconds: 300,
  },
  async () => {
    try {
      await runSync({
        clientId: googleOauthClientId.value(),
        clientSecret: googleOauthClientSecret.value(),
        anthropicApiKey: anthropicApiKey.value(),
      });
    } catch (err) {
      await db.collection('execInboxStatus').doc('singleton').set(
        { lastSyncError: err.message || String(err), lastSyncErrorAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }
  }
);
