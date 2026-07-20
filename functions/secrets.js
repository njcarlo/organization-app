import { defineSecret } from 'firebase-functions/params';

export const googleOauthClientId = defineSecret('GOOGLE_OAUTH_CLIENT_ID');
export const googleOauthClientSecret = defineSecret('GOOGLE_OAUTH_CLIENT_SECRET');
export const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');
export const resendApiKey = defineSecret('RESEND_API_KEY');
