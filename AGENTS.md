## Project Summary
Construction Quality Pulse - Enterprise Construction Quality Assurance System for managing construction site inspections, QA reports, and compliance tracking.

## Tech Stack
- **Framework**: Next.js 15.3 with App Router and Turbopack
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Database**: PostgreSQL via Supabase
- **Authentication**: Custom JWT with bcrypt
- **Notifications**: Real-time polling system
- **Export**: jsPDF for PDF, native CSV generation

## Architecture
```
src/
├── app/
│   ├── api/                    # API routes
│   │   ├── auth/               # Login, register, me
│   │   ├── users/              # User CRUD (admin only)
│   │   ├── sites/              # Site CRUD with assignments
│   │   ├── reports/            # QA report submission/review
│   │   ├── notifications/      # Notification management
│   │   ├── analytics/          # Server-side analytics
│   │   ├── audit-logs/         # Audit log viewing
│   │   ├── export/             # CSV and PDF export
│   │   └── upload/             # Photo upload
│   ├── admin/                  # Admin dashboard pages
│   ├── engineer/               # Engineer dashboard pages
│   ├── login/                  # Auth pages
│   └── register/
├── components/                 # Shared UI components
├── lib/
│   ├── auth.ts                # JWT utilities
│   ├── auth-context.tsx       # Auth provider
│   ├── middleware.ts          # Route protection
│   ├── types.ts               # TypeScript interfaces
│   └── supabase/              # Database clients
└── public/uploads/            # Photo storage
```

## User Preferences
- Clean enterprise dashboard design
- White/slate/gray base with blue accents
- Flat design, no glassmorphism or gradients

## Project Guidelines
- JWT authentication with role-based access (admin/engineer)
- All user actions logged to audit_logs table
- Reports follow pending -> approved/rejected lifecycle
- Notifications created for site assignments and report reviews

## Common Patterns
- withAuth() middleware for protected API routes
- AuthGuard component for protected pages
- DashboardLayout with responsive sidebar
- Toast notifications via Sonner
