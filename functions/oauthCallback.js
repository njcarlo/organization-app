import { onRequest } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './admin.js';
import { createOauthClient } from './googleOauthClient.js';
import { googleOauthClientId, googleOauthClientSecret } from './secrets.js';
import { REGION, oauthCallbackUrl } from './config.js';

const APP_URL = 'https://tracker-hae.web.app';

export const oauthCallback = onRequest(
  { region: REGION, secrets: [googleOauthClientId, googleOauthClientSecret] },
  async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state) {
      res.redirect(`${APP_URL}/executive-inbox?error=missing_params`);
      return;
    }

    const stateRef = db.collection('execInboxOAuthState').doc(String(state));
    const stateSnap = await stateRef.get();
    if (!stateSnap.exists) {
      res.redirect(`${APP_URL}/executive-inbox?error=invalid_state`);
      return;
    }
    const { uid } = stateSnap.data();
    await stateRef.delete();

    try {
      const oauth2Client = createOauthClient(
        googleOauthClientId.value(),
        googleOauthClientSecret.value(),
        oauthCallbackUrl()
      );
      const { tokens } = await oauth2Client.getToken(String(code));
      oauth2Client.setCredentials(tokens);

      const oauth2 = (await import('googleapis')).google.oauth2({ version: 'v2', auth: oauth2Client });
      const { data: userinfo } = await oauth2.userinfo.get();

      const tokenDoc = {
        accessToken: tokens.access_token,
        accessTokenExpiry: tokens.expiry_date || null,
        scope: tokens.scope || null,
        connectedEmail: userinfo.email || null,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (tokens.refresh_token) {
        tokenDoc.refreshToken = tokens.refresh_token;
        tokenDoc.lastHistoryId = null;
      }
      await db.collection('execInboxTokens').doc(uid).set(tokenDoc, { merge: true });

      await db.collection('execInboxStatus').doc('singleton').set({
        connected: true,
        connectedEmail: userinfo.email || null,
        connectedBy: uid,
        connectedAt: FieldValue.serverTimestamp(),
        lastSyncedAt: null,
        lastSyncError: null,
      });

      res.redirect(`${APP_URL}/executive-inbox?connected=1`);
    } catch (err) {
      res.redirect(`${APP_URL}/executive-inbox?error=oauth_failed`);
    }
  }
);
