# Construction Quality Pulse 🏗️

Enterprise Construction Quality Assurance System for managing construction site inspections, QA reports, and compliance tracking.

## 🏛️ Architecture

This system consists of two main components:
- **Frontend**: Next.js 15 with App Router (TypeScript)
- **Backend**: Node.js Express API with MongoDB

## 🚀 Quick Start

### Prerequisites

- Node.js 20.x or higher
- MongoDB Atlas account (or local MongoDB)
- Firebase project with Authentication enabled

### 1. Clone and Install

```bash
git clone https://github.com/Anamitra-Sarkar/Construction-Pulse.git
cd Construction-Pulse
npm install
```

### 2. Environment Setup

**CRITICAL**: Never reuse Firebase credentials across different projects! Each deployment must have its own Firebase project.

Create a `.env.local` file in the root directory by copying `.env.example`:

```bash
cp .env.example .env.local
```

Then fill in your environment variables. See [Environment Variables](#environment-variables) section below for detailed instructions.

### 3. Start the Development Servers

**Backend** (Terminal 1):
```bash
npm run dev:backend
# Server runs on http://localhost:5000
```

**Frontend** (Terminal 2):
```bash
npm run dev
# App runs on http://localhost:3000
```

### 4. Bootstrap Initial Admin

After both servers are running, visit:
```
http://localhost:3000/bootstrap-admin
```

Create your first administrator account. This route is automatically disabled after the first admin is created.

## 🔐 Environment Variables

The application requires specific environment variables to function correctly. Misconfiguration will cause startup failures with clear error messages.

### Required Variables

#### MongoDB
```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/quality_pulse
```

#### Firebase Client Configuration (Frontend)
All these variables must start with `NEXT_PUBLIC_` to be available in the browser:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=1:your-sender-id:web:your-app-id
NEXT_PUBLIC_FIREBASE_ENABLED=true
```

#### Firebase Admin Configuration (Backend)
⚠️ **SECURITY**: These must match the same Firebase project as the client config:

```env
FIREBASE_PROJECT_ID=your-project-id        # Must match NEXT_PUBLIC_FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

#### API Configuration
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api   # Must end with /api
```

#### Admin Recovery Token
```env
ADMIN_RECOVERY_TOKEN=your-secure-random-token   # Generate with: openssl rand -hex 32
```

### Getting Firebase Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or select existing)
3. Enable **Authentication** → Sign-in method → Email/Password
4. Go to **Project Settings** → General → Your apps → Add web app
5. Copy the Firebase config values to `NEXT_PUBLIC_FIREBASE_*` variables
6. Go to **Project Settings** → Service accounts → Generate new private key
7. From the downloaded JSON, copy:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep quotes and newlines: `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"`)

### Validation on Startup

The backend includes defensive checks that validate:
- ✅ All required Firebase environment variables are present
- ✅ Backend and frontend Firebase project IDs match
- ✅ Service account credentials are valid

If any check fails, the server will **refuse to start** with a clear error message indicating what needs to be fixed.

## 🛠️ Common Issues

### Issue: "Firebase project mismatch" error

**Cause**: Backend `FIREBASE_PROJECT_ID` doesn't match frontend `NEXT_PUBLIC_FIREBASE_PROJECT_ID`

**Solution**: 
```bash
# Verify both variables point to the same Firebase project
echo $FIREBASE_PROJECT_ID
echo $NEXT_PUBLIC_FIREBASE_PROJECT_ID
```

### Issue: User operations return validation errors mentioning "farmer" or "firebaseUid"

**Cause**: `NEXT_PUBLIC_API_URL` is misconfigured or pointing to wrong backend

**Solution**:
1. Verify `NEXT_PUBLIC_API_URL` ends with `/api`
2. Ensure the backend is running and accessible
3. Check browser console for network errors

### Issue: Server refuses to start with "FIREBASE_PROJECT_ID is not set"

**Cause**: Environment variables not loaded or .env.local missing

**Solution**:
```bash
# Check if .env.local exists
ls -la .env.local

# If missing, copy from example
cp .env.example .env.local

# Fill in your actual values
nano .env.local
```

## 📦 Available Scripts

- `npm run dev` - Start Next.js development server (port 3000)
- `npm run dev:backend` - Start Express backend (port 5000)
- `npm run build` - Build Next.js production bundle
- `npm run start` - Start Next.js production server
- `npm run start:backend` - Start Express backend in production mode
- `npm run lint` - Run ESLint

## 📚 Documentation

- [Deployment Guide](./DEPLOYMENT.md) - Full deployment instructions for Vercel + Render
- [Visual Guide](./VISUAL_GUIDE.md) - UI component documentation
- [Agents Guide](./AGENTS.md) - AI agent configuration

## 🏗️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, TailwindCSS
- **Backend**: Node.js, Express, MongoDB (Mongoose)
- **Authentication**: Firebase Authentication with JWT
- **Real-time**: Socket.io for notifications
- **PDF Export**: jsPDF + jsPDF-autotable
- **File Upload**: Multer

## 👥 User Roles

- **Admin**: Full system access, user management, site management, report approval
- **Engineer**: Submit QA reports, view assigned sites, track own submissions

## 🔒 Security Features

- Role-based access control (RBAC)
- Multi-party approval for critical admin operations
- Last-admin protection (cannot delete/deactivate last admin)
- Audit logging for all administrative actions
- Input validation and sanitization
- Firebase project mismatch detection

## 📝 License

This project is private and proprietary.

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
