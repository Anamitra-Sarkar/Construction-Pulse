# Construction Quality Pulse - Deployment Guide

This enterprise system consists of a **Next.js Frontend** (deployed on Vercel) and a **Node.js Express Backend** (deployed on Render).

## 🔐 Critical Security Notice

**NEVER reuse Firebase service account credentials across different projects!**

Each deployment must have:
- Its own dedicated Firebase project
- Its own service account credentials
- Matching project IDs between backend and frontend configurations

Mixing credentials from different projects (e.g., using Agromind credentials for Construction-Pulse) will cause validation errors and authentication failures.

## 1. Backend Deployment (Render)

### Prerequisites
- MongoDB Atlas cluster
- Firebase Project with Service Account (JSON)

### Steps
1. Create a new **Web Service** on Render.
2. Connect your repository.
3. Set **Root Directory** to `server`.
4. Set **Runtime** to `Node`.
5. Set **Build Command** to `npm install`.
6. Set **Start Command** to `node index.js`.
7. Add the following **Environment Variables**:
   - `MONGODB_URI`: Your MongoDB connection string.
   - `FIREBASE_PROJECT_ID`: Your Firebase project ID (e.g., `construction-pulse-prod`).
   - `FIREBASE_CLIENT_EMAIL`: Your Firebase service account email.
   - `FIREBASE_PRIVATE_KEY`: Your Firebase service account private key (paste the full key including `-----BEGIN...`).
   - `ADMIN_RECOVERY_TOKEN`: A long, random string for emergency admin recovery.
   - `PORT`: `5000` (or leave default).

⚠️ **IMPORTANT**: Verify that `FIREBASE_PROJECT_ID` matches your intended Firebase project. The server will fail to start if there's a mismatch with the frontend project ID.

## 2. Frontend Deployment (Vercel)

### Prerequisites
- Backend URL (from Render deployment)
- Firebase Client Configuration

### Steps
1. Create a new project on Vercel.
2. Connect your repository.
3. Configure the **Build Settings**:
   - Framework Preset: `Next.js`.
   - Build Command: `npm run build` (default).
4. Add the following **Environment Variables**:
   - `NEXT_PUBLIC_API_URL`: `https://your-backend-url.onrender.com/api` ⚠️ **Must end with `/api`**
   - `NEXT_PUBLIC_FIREBASE_API_KEY`: Firebase Client API Key
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`: Firebase Auth Domain
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`: Firebase Project ID ⚠️ **Must match `FIREBASE_PROJECT_ID` in backend**
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`: Firebase Storage Bucket
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`: Firebase Messaging Sender ID
   - `NEXT_PUBLIC_FIREBASE_APP_ID`: Firebase App ID

### ✅ Post-Deployment Verification

After deploying both backend and frontend:

1. Check the backend logs on Render for the Firebase initialization message:
   ```
   ✅ Firebase Admin SDK initialized successfully
      Project: your-project-id
      Service Account: firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
   ```

2. If you see a project mismatch error, verify:
   - `FIREBASE_PROJECT_ID` in backend matches `NEXT_PUBLIC_FIREBASE_PROJECT_ID` in frontend
   - Both point to the correct Firebase project for this deployment
   - You're not accidentally using credentials from a different project

3. Test the authentication flow:
   - Try logging in with an existing user
   - Try creating a new user (if you're an admin)
   - Verify that user operations (activate/deactivate) work correctly

## 3. Post-Deployment Setup (Critical)

1. Navigate to `https://your-frontend.vercel.app/bootstrap-admin`.
2. Follow the instructions to create the **first administrator account**.
3. Once completed, this route is **permanently disabled**.
4. Log in to the dashboard and start managing users and construction sites.

## 4. Disaster Recovery

If all admin accounts are lost or locked out:
1. Use the `/api/governance/admin-recovery` endpoint.
2. Send a POST request with the `ADMIN_RECOVERY_TOKEN` and new admin details.
3. This will bypass standard authentication to restore system access.

```bash
curl -X POST https://your-backend.onrender.com/api/governance/admin-recovery \
  -H "Content-Type: application/json" \
  -d '{
    "recoveryToken": "YOUR_ADMIN_RECOVERY_TOKEN",
    "email": "newadmin@company.com",
    "password": "SecurePassword123!",
    "name": "Recovery Admin"
  }'
```

## 5. Common Deployment Issues

### Issue: "Firebase project mismatch" error on backend startup

**Cause**: Backend `FIREBASE_PROJECT_ID` doesn't match frontend `NEXT_PUBLIC_FIREBASE_PROJECT_ID`

**Solution**: 
1. Verify both environment variables are set correctly
2. Ensure they point to the same Firebase project
3. Redeploy after fixing the configuration

### Issue: User operations return 400 with "firebaseUid is required" or "invalid role" errors

**Cause**: API requests are hitting the wrong backend URL or using wrong Firebase credentials

**Solution**:
1. Check that `NEXT_PUBLIC_API_URL` is correct and ends with `/api`
2. Verify the backend URL is accessible and running
3. Ensure all Firebase credentials are from the same project
4. Check backend logs for Firebase initialization errors

### Issue: Authentication fails or returns 401 errors

**Cause**: Frontend and backend Firebase projects don't match, or credentials are invalid

**Solution**:
1. Regenerate service account credentials from Firebase Console
2. Ensure both frontend and backend use the same Firebase project ID
3. Verify the private key is correctly formatted (including newlines)
4. Check that all required Firebase environment variables are set
