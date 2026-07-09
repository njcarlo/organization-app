import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyBeoG-8bFneTzgOx-2IDHZixpozHCChjUQ',
  authDomain: 'hae-tracker-516ee.firebaseapp.com',
  projectId: 'hae-tracker-516ee',
  storageBucket: 'hae-tracker-516ee.firebasestorage.app',
  messagingSenderId: '1052897331519',
  appId: '1:1052897331519:web:d88605854ca70de9fd2b8a',
  measurementId: 'G-FYCZT899ZZ',
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// Secondary app so admins can create users without signing themselves out
const secondaryApp =
  getApps().find((a) => a.name === 'Secondary') ||
  initializeApp(firebaseConfig, 'Secondary')
export const secondaryAuth = getAuth(secondaryApp)
