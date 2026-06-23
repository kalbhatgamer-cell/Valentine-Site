import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function normalizePrivateKey(value = '') {
  let key = String(value).trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    try { key = JSON.parse(key); } catch { key = key.slice(1, -1); }
  }
  return key.replace(/\\n/g, '\n');
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

if (!projectId || !clientEmail || !privateKey) {
  throw new Error('Missing Firebase Admin environment variables. Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.');
}

const adminApp = getApps()[0] || initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
  projectId
});

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
