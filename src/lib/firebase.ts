'use client';

import type { Auth } from 'firebase/auth';

let auth: Auth | null = null;
let firebaseInitError: Error | null = null;
let initialized = false;

export const isFirebaseEnabled = process.env.NEXT_PUBLIC_FIREBASE_ENABLED === 'true';

export const initFirebaseAuth = async (): Promise<{ auth: Auth | null; firebaseInitError: Error | null }> => {
  if (initialized) {
    return { auth, firebaseInitError };
  }
  initialized = true;

  if (!isFirebaseEnabled) {
    firebaseInitError = new Error(
      'Firebase authentication is disabled. Set NEXT_PUBLIC_FIREBASE_ENABLED=true to enable.'
    );
    return { auth, firebaseInitError };
  }

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() || '',
  };

  const hasAllValues = Object.values(firebaseConfig).every(Boolean);
  const isLikelyApiKey = firebaseConfig.apiKey.startsWith('AIza') && firebaseConfig.apiKey.length > 30;
  const isLikelyAuthDomain =
    firebaseConfig.authDomain.includes('firebaseapp.com') ||
    firebaseConfig.authDomain.includes('web.app');

  if (!hasAllValues || !isLikelyApiKey || !isLikelyAuthDomain) {
    firebaseInitError = new Error(
      'Missing or invalid Firebase web config. Check NEXT_PUBLIC_FIREBASE_* env vars.'
    );
    return { auth, firebaseInitError };
  }

  try {
    const { initializeApp, getApps, getApp } = await import('firebase/app');
    const { getAuth } = await import('firebase/auth');
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
  } catch (error) {
    firebaseInitError = error as Error;
    auth = null;
  }

  return { auth, firebaseInitError };
};

export { auth, firebaseInitError };
