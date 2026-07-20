# Zentra by FPC — Campus Operations & Timetable System

A modern, serverless Next.js 16 web application powered by **Turso Cloud Database (LibSQL)** to coordinate university timetables, student attendance, academic trackers, fee collections, faculty handovers, and demo allocations.

---

## 🛠️ Technology Stack & Architecture

- **Framework**: Next.js 16 (App Router & Turbopack)
- **UI & Styling**: React 19, Vanilla Tailwind CSS v4, Lucide React, Glassmorphic Aesthetics
- **Cloud Database**: Turso Cloud Database (`@libsql/client`) — Serverless SQLite on LibSQL
- **Email Notifications**: Google Apps Script (GAS) Mail Integration

---

## 👥 Multi-Role Ecosystem & Portals

### 1. 🛡️ Super Admin Console (`/admin`)
- Full administrative control over all university campuses, departments, mentors, students, and system configurations.
- Review and approve pending signup requests.
- Manage global academic years, events, and department mappings.

### 2. 💼 Key Account Manager (KAM) Workspace (`/kam`)
- Campus-wide task management and issue tracking across partner institutions.
- High-level oversight of campus metrics and daily operation logs.

### 3. 🏢 Campus Manager (CAM) Dashboard (`/cam`)
- Manage faculty profiles, department subjects, shift configurations, and classroom assignments.
- Monitor date-specific class handover requests and daily campus orders.

### 4. 👩‍🏫 Faculty Mentor Workspace (`/mentor`)
- Personal weekly class schedule and workload breakdown.
- Request date-specific slot covers (handovers/swaps) with fellow mentors.
- Track student attendance, viva assessments, and weekly task submissions.

### 5. 🎓 Student Portal (`/student`)
- View class timetables, attendance stats, and fee payment statuses.
- Submit weekly assignment tasks and track viva evaluations.

### 6. 💳 Fee Manager Console (`/fee-manager`)
- Track term-wise student tuition fees, FPC dues, and payment transactions.
- Generate digital receipts and payment links.

### 7. 🧪 SME & Demo Allocator Portals (`/sme`, `/allocator`)
- Subject Matter Expert (SME) demo evaluation sessions and demo swap management.
- Dynamic scheduler for demo slot allocations.

---

## 🔒 Security & Self-Service Features

- **Self-Service Change Password:** All logged-in users can update their account password directly from their top-right profile dropdown menu across any workspace.
- **Centralized User Access:** Single `users` table synced with role-specific tables (`students`, `mentors`, `sme_users`, `admin_users`).

---

## ⚡ Getting Started & Environment Setup

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Thanush2412/Zentra.git
cd Zentra
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the root directory based on `.env.example`:

```env
# Zentra by FPC - Environment Variables
NEXT_PUBLIC_GAS_MAIL_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec

# Turso Cloud Database Credentials
TURSO_DATABASE_URL="libsql://your-database.turso.io"
TURSO_AUTH_TOKEN="your_turso_auth_token_here"
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Production Build & Start
```bash
npm run build
npm run start
```

---

## 📄 License & Credits
© 2026 **Zentra by FPC** · All rights reserved.
