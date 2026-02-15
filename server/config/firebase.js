const admin = require('firebase-admin');

// ========================================
// DEFENSIVE FIREBASE ADMIN INITIALIZATION
// ========================================
// Ensures we're using the correct Firebase project
// and fails early with clear errors if misconfigured

const EXPECTED_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FRONTEND_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

// Validate required environment variables
if (!EXPECTED_PROJECT_ID) {
  throw new Error(
    'CRITICAL: FIREBASE_PROJECT_ID is not set. ' +
    'This environment variable is required for Firebase Admin SDK initialization. ' +
    'Check your .env or deployment configuration.'
  );
}

if (!process.env.FIREBASE_CLIENT_EMAIL) {
  throw new Error(
    'CRITICAL: FIREBASE_CLIENT_EMAIL is not set. ' +
    'This environment variable is required for Firebase Admin SDK initialization. ' +
    'Check your .env or deployment configuration.'
  );
}

if (!process.env.FIREBASE_PRIVATE_KEY) {
  throw new Error(
    'CRITICAL: FIREBASE_PRIVATE_KEY is not set. ' +
    'This environment variable is required for Firebase Admin SDK initialization. ' +
    'Check your .env or deployment configuration.'
  );
}

// Validate private key format (basic check for PEM structure)
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (!privateKey.includes('BEGIN PRIVATE KEY') || !privateKey.includes('END PRIVATE KEY')) {
  throw new Error(
    'CRITICAL: FIREBASE_PRIVATE_KEY appears to be malformed. ' +
    'It must be a valid PEM-formatted private key including BEGIN/END markers. ' +
    'Ensure the key is properly escaped with \\n for newlines.'
  );
}

// Cross-check that backend and frontend are configured for the same Firebase project
if (FRONTEND_PROJECT_ID && FRONTEND_PROJECT_ID !== EXPECTED_PROJECT_ID) {
  console.error('========================================');
  console.error('🚨 FIREBASE PROJECT MISMATCH DETECTED 🚨');
  console.error('========================================');
  console.error(`Backend project:  ${EXPECTED_PROJECT_ID}`);
  console.error(`Frontend project: ${FRONTEND_PROJECT_ID}`);
  console.error('');
  console.error('This configuration will cause authentication and data access issues.');
  console.error('Ensure FIREBASE_PROJECT_ID and NEXT_PUBLIC_FIREBASE_PROJECT_ID match.');
  console.error('========================================');
  
  throw new Error(
    `Firebase project mismatch: backend=${EXPECTED_PROJECT_ID}, frontend=${FRONTEND_PROJECT_ID}. ` +
    'Both must use the same Firebase project. Check your environment variables.'
  );
}

const firebaseConfig = {
  projectId: EXPECTED_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: privateKey.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(firebaseConfig),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  });
  
  // Log initialization success (only in development to avoid exposing sensitive info in prod logs)
  if (process.env.NODE_ENV !== 'production') {
    console.log('✅ Firebase Admin SDK initialized successfully');
    console.log(`   Project: ${EXPECTED_PROJECT_ID}`);
    console.log(`   Service Account: ${process.env.FIREBASE_CLIENT_EMAIL}`);
  } else {
    console.log('✅ Firebase Admin SDK initialized successfully');
  }
}

module.exports = admin;
