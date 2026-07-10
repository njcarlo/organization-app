export const REGION = 'us-east1';

export function oauthCallbackUrl() {
  const projectId = process.env.GCLOUD_PROJECT;
  return `https://${REGION}-${projectId}.cloudfunctions.net/oauthCallback`;
}
