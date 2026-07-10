import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './admin.js';
import { assertExecInboxAllowed } from './execInboxAllowlist.js';
import { createOauthClient, EXEC_INBOX_SCOPES } from './googleOauthClient.js';
import { googleOauthClientId, googleOauthClientSecret } from './secrets.js';
import { REGION, oauthCallbackUrl } from './config.js';

export const execInboxGetOauthUrl = onCall(
  { region: REGION, secrets: [googleOauthClientId, googleOauthClientSecret] },
  async (request) => {
    let email;
    try {
      email = assertExecInboxAllowed(request.auth?.token);
    } catch {
      throw new HttpsError('permission-denied', 'Not authorized for Executive Inbox.');
    }

    const state = db.collection('execInboxOAuthState').doc().id;
    await db.collection('execInboxOAuthState').doc(state).set({
      uid: request.auth.uid,
      email,
      createdAt: FieldValue.serverTimestamp(),
    });

    const oauth2Client = createOauthClient(
      googleOauthClientId.value(),
      googleOauthClientSecret.value(),
      oauthCallbackUrl()
    );

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: EXEC_INBOX_SCOPES,
      state,
    });

    return { url };
  }
);
