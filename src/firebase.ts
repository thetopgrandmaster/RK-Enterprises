import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, getDocFromServer, doc } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";
import firebaseConfig from '../firebase-applet-config.json';

// Use environment variables for Vercel deployment, fallback to JSON config for local dev
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
};

const app = initializeApp(config);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Initialize Analytics only if supported
let analytics = null;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (e) {
    console.warn("Firebase Analytics not initialized:", e);
  }
}
export { analytics };

// Check if Firestore is enabled and working
async function checkFirestore() {
  try {
    // Try a simple read to verify Firestore is enabled in the project
    await getDocFromServer(doc(db, '_connection_test_', 'test'));
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      console.warn("Firestore access denied. Please check your security rules.");
    } else if (error.message?.includes('offline') || error.code === 'unavailable') {
      console.error("CRITICAL: Firestore is not enabled or the project is incorrect. Data will NOT be saved.");
    }
  }
}
checkFirestore();
