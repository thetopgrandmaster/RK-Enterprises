import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, getDocFromServer, doc } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Initialize Analytics only if supported (it might not be in some environments)
let analytics = null;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (e) {
    console.warn("Firebase Analytics not initialized:", e);
  }
}
export { analytics };
