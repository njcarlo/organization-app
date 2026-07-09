import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDuaK_y5RvYzSTHly9xO9gU2ywEEBuKirQ',
  authDomain: 'hae-operating-tracker.firebaseapp.com',
  projectId: 'hae-operating-tracker',
  storageBucket: 'hae-operating-tracker.firebasestorage.app',
  messagingSenderId: '63445249864',
  appId: '1:63445249864:web:66c39d6c6e1c005068cd7d',
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// Secondary app so admins can create users without signing themselves out
const secondaryApp =
  getApps().find((a) => a.name === 'Secondary') ||
  initializeApp(firebaseConfig, 'Secondary')
export const secondaryAuth = getAuth(secondaryApp)
