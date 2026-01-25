const admin = require('firebase-admin');

const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(firebaseConfig),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  });
}

module.exports = admin;
