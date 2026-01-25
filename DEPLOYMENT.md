# Construction Quality Pulse - Deployment Guide

This enterprise system consists of a **Next.js Frontend** (deployed on Vercel) and a **Node.js Express Backend** (deployed on Render).

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
   - `FIREBASE_PROJECT_ID`: Your Firebase project ID.
   - `FIREBASE_CLIENT_EMAIL`: Your Firebase service account email.
   - `FIREBASE_PRIVATE_KEY`: Your Firebase service account private key (paste the full key including `-----BEGIN...`).
   - `ADMIN_RECOVERY_TOKEN`: A long, random string for emergency admin recovery.
   - `PORT`: `5000` (or leave default).

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
   - `NEXT_PUBLIC_API_URL`: `https://your-backend-url.onrender.com/api`
   - `NEXT_PUBLIC_FIREBASE_API_KEY`: Firebase Client API Key
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`: Firebase Auth Domain
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`: Firebase Project ID
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`: Firebase Storage Bucket
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`: Firebase Messaging Sender ID
   - `NEXT_PUBLIC_FIREBASE_APP_ID`: Firebase App ID

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
