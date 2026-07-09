const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { setGlobalOptions } = require('firebase-functions/v2')

initializeApp()
setGlobalOptions({ region: 'us-central1' })

/**
 * Mint a short-lived custom token so a signed-in user can open another
 * HAE Hosting site without entering credentials again.
 */
exports.createSsoToken = onCall({ cors: true }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required.')
  }

  try {
    const token = await getAuth().createCustomToken(request.auth.uid)
    return { token }
  } catch (err) {
    console.error('createSsoToken failed', err)
    throw new HttpsError('internal', 'Could not create SSO token.')
  }
})
