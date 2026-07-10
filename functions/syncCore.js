import { google } from 'googleapis';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './admin.js';
import { createOauthClient } from './googleOauthClient.js';
import { looksLikeNewsletter, extractHeader, extractEmailAddress } from './newsletterDomains.js';
import { classifyEmail, CLASSIFIER_VERSION } from './classifyEmail.js';
import { oauthCallbackUrl } from './config.js';

const INITIAL_SYNC_WINDOW = 'newer_than:7d';
const CALENDAR_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const STALE_MEETING_MS = 24 * 60 * 60 * 1000;

async function getAuthorizedClient(clientId, clientSecret, tokenDoc, tokenRef) {
  const oauth2Client = createOauthClient(clientId, clientSecret, oauthCallbackUrl());
  oauth2Client.setCredentials({
    refresh_token: tokenDoc.refreshToken,
    access_token: tokenDoc.accessToken,
    expiry_date: tokenDoc.accessTokenExpiry,
  });

  oauth2Client.on('tokens', async (tokens) => {
    const update = {};
    if (tokens.access_token) update.accessToken = tokens.access_token;
    if (tokens.expiry_date) update.accessTokenExpiry = tokens.expiry_date;
    if (Object.keys(update).length) {
      await tokenRef.set(update, { merge: true });
    }
  });

  return oauth2Client;
}

async function syncGmail(oauth2Client, anthropicApiKey, tokenRef, tokenDoc) {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  let processed = 0;
  let newHistoryId = tokenDoc.lastHistoryId || null;

  const messageIds = [];

  if (tokenDoc.lastHistoryId) {
    try {
      let pageToken;
      do {
        const { data } = await gmail.users.history.list({
          userId: 'me',
          startHistoryId: tokenDoc.lastHistoryId,
          historyTypes: ['messageAdded'],
          pageToken,
        });
        for (const record of data.history || []) {
          for (const added of record.messagesAdded || []) {
            messageIds.push(added.message.id);
          }
        }
        newHistoryId = data.historyId || newHistoryId;
        pageToken = data.nextPageToken;
      } while (pageToken);
    } catch (err) {
      if (err.code !== 404) throw err;
      tokenDoc.lastHistoryId = null;
    }
  }

  if (!tokenDoc.lastHistoryId) {
    let pageToken;
    do {
      const { data } = await gmail.users.messages.list({
        userId: 'me',
        q: INITIAL_SYNC_WINDOW,
        pageToken,
      });
      for (const m of data.messages || []) messageIds.push(m.id);
      pageToken = data.nextPageToken;
    } while (pageToken);

    const profile = await gmail.users.getProfile({ userId: 'me' });
    newHistoryId = profile.data.historyId;
  }

  for (const messageId of messageIds) {
    const { data: meta } = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'List-Unsubscribe', 'Date'],
    });

    if (looksLikeNewsletter({ labelIds: meta.labelIds, headers: meta.payload?.headers })) {
      continue;
    }

    const headers = meta.payload?.headers;
    const fromHeader = extractHeader(headers, 'From');
    const subject = extractHeader(headers, 'Subject');
    const snippet = meta.snippet || '';

    let tags = [];
    let reasoning = '';
    let classificationError = false;
    try {
      const result = await classifyEmail(anthropicApiKey, { from: fromHeader, subject, snippet });
      tags = result.tags;
      reasoning = result.reasoning;
    } catch {
      tags = ['action_item'];
      classificationError = true;
    }

    if (tags.includes('newsletter')) continue;

    await db.collection('execInboxEmails').doc(messageId).set({
      gmailMessageId: messageId,
      threadId: meta.threadId,
      from: fromHeader,
      fromEmail: extractEmailAddress(fromHeader),
      subject,
      snippet,
      receivedAt: Number(meta.internalDate) || null,
      tags,
      reasoning,
      classifierVersion: CLASSIFIER_VERSION,
      classificationError,
      permalink: `https://mail.google.com/mail/u/0/#inbox/${meta.threadId}`,
    });
    processed += 1;
  }

  if (newHistoryId) {
    await tokenRef.set({ lastHistoryId: newHistoryId }, { merge: true });
  }

  return processed;
}

async function syncCalendar(oauth2Client) {
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const now = new Date();
  const timeMax = new Date(now.getTime() + CALENDAR_WINDOW_MS);

  let processed = 0;
  let pageToken;
  do {
    const { data } = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      pageToken,
    });

    for (const event of data.items || []) {
      const start = event.start?.dateTime || event.start?.date || null;
      const end = event.end?.dateTime || event.end?.date || null;
      await db.collection('execInboxMeetings').doc(event.id).set({
        gcalEventId: event.id,
        title: event.summary || '(No title)',
        start,
        end,
        location: event.location || '',
        attendees: (event.attendees || []).map((a) => a.email).filter(Boolean),
        htmlLink: event.htmlLink || '',
        updatedAt: FieldValue.serverTimestamp(),
      });
      processed += 1;
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  const staleCutoff = new Date(now.getTime() - STALE_MEETING_MS).toISOString();
  const staleSnap = await db
    .collection('execInboxMeetings')
    .where('end', '<', staleCutoff)
    .limit(500)
    .get();
  const batch = db.batch();
  staleSnap.forEach((doc) => batch.delete(doc.ref));
  if (!staleSnap.empty) await batch.commit();

  return processed;
}

export async function runSync({ clientId, clientSecret, anthropicApiKey }) {
  const statusSnap = await db.collection('execInboxStatus').doc('singleton').get();
  const connectedBy = statusSnap.exists ? statusSnap.data()?.connectedBy : null;

  let tokenRef;
  let tokenDoc;
  if (connectedBy) {
    tokenRef = db.collection('execInboxTokens').doc(connectedBy);
    const tokenSnap = await tokenRef.get();
    if (!tokenSnap.exists) {
      throw new Error('No connected Google account.');
    }
    tokenDoc = tokenSnap.data();
  } else {
    const tokensSnap = await db.collection('execInboxTokens').limit(1).get();
    if (tokensSnap.empty) {
      throw new Error('No connected Google account.');
    }
    tokenRef = tokensSnap.docs[0].ref;
    tokenDoc = tokensSnap.docs[0].data();
  }

  const oauth2Client = await getAuthorizedClient(clientId, clientSecret, tokenDoc, tokenRef);

  const emailsProcessed = await syncGmail(oauth2Client, anthropicApiKey, tokenRef, tokenDoc);
  const meetingsProcessed = await syncCalendar(oauth2Client);

  await db.collection('execInboxStatus').doc('singleton').set(
    {
      lastSyncedAt: FieldValue.serverTimestamp(),
      lastSyncError: null,
    },
    { merge: true }
  );

  return { emailsProcessed, meetingsProcessed };
}
