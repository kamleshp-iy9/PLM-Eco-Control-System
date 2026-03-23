# PLM - Engineering Change Order (ECO) System 

> Built in 24 hours at Hackathon 2026

A full-stack Product Lifecycle Management system for managing Engineering Change Orders (ECOs), Bill of Materials (BOMs), and product versioning - with role-based access control, configurable approval workflows, real-time updates, and a full audit trail.

---

## Demo Video

[![PLM ECO System Demo](https://img.shields.io/badge/YouTube-Watch%20Demo-red?logo=youtube&logoColor=white&style=for-the-badge)](https://youtu.be/fqHUgY9hRNA)

Submmited video (on odoo portal): https://drive.google.com/file/d/1r0Fnx_nnt4tHxrmgVdH3Sa5nh-ngSovY/view?usp=sharing

---

## Features

- **Products** — Create, version, and track products with attachments
- **Bill of Materials (BOM)** — Manage components and manufacturing operations per product
- **Engineering Change Orders (ECO)** - Raise, track, and apply changes to products or BOMs
- **Configurable Approval Workflow** — Multi-stage ECO pipeline with per-stage approval rules (Required / Optional / Comment Only)
- **Role-Based Access Control** — Four roles: Admin, Engineering User, Approver, Operations User
- **Audit Trail** — Full history of every action on every ECO
- **Real-Time Updates** - Socket.io powered live notifications
- **Reports** — ECO and product reports
- **Admin Panel** — Manage users, approve/reject registrations, assign roles
- **File Uploads** - Attach files to products, BOMs, and ECOs

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui |
| State | Zustand |
| Backend | Node.js + Express.js |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT (access + refresh tokens) |
| Real-time | Socket.io |
| File Upload | Multer |
| Security | Helmet + express-rate-limit |

---

## User Roles

| Role | Access |
|---|---|
| `ADMIN` | Full access — user management, settings, all ECOs |
| `ENGINEERING_USER` | Create and manage ECOs, products, BOMs |
| `APPROVER` | Review and approve/reject ECOs at assigned stages |
| `OPERATIONS_USER` | Read-only access to ECOs and products |

---

## Project Structure

```
plm-system/
├── client/                  # React + TypeScript frontend
│   └── src/
│       ├── pages/           # Route-level page components
│       ├── components/      # Shared UI components
│       ├── stores/          # Zustand state stores
│       └── hooks/           # Custom React hooks
│
└── server/                  # Express.js backend
    ├── src/
    │   ├── routes/          # API route definitions
    │   ├── controllers/     # Request handlers
    │   ├── services/        # Business logic
    │   ├── middleware/      # Auth, roles, rate-limit
    │   └── utils/           # Helpers and error classes
    └── prisma/
        └── schema.prisma    # Database schema
```

---

## Prerequisites

- Node.js v18+
- PostgreSQL 14+
- npm v9+

---

## Setup & Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-username/plm-eco-system.git
cd plm-eco-system
```

### 2. Configure environment variables

Create `plm-system/server/.env`:

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/plm_system
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
PORT=5000
CLIENT_URL=http://localhost:5173
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

### 3. Install all dependencies

```bash
cd plm-system
npm run install:all
```

### 4. Run database migrations and seed

```bash
npm run db:migrate
npm run db:seed
```

### 5. Start the development server

```bash
npm run dev
```

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend API: [http://localhost:5000](http://localhost:5000)

---

## Available Scripts

From the `plm-system/` directory:

| Script | Description |
|---|---|
| `npm run dev` | Start both frontend and backend concurrently |
| `npm run dev:server` | Start backend only |
| `npm run dev:client` | Start frontend only |
| `npm run build` | Build frontend for production |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed the database |
| `npm run db:reset` | Reset the database (destructive) |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/register` | Register |
| GET | `/api/products` | List products |
| GET | `/api/boms` | List BOMs |
| GET | `/api/ecos` | List ECOs |
| POST | `/api/ecos` | Create ECO |
| PATCH | `/api/ecos/:id/stage` | Move ECO to next stage |
| POST | `/api/ecos/:id/approve` | Approve/reject ECO |
| GET | `/api/audit-logs` | Get audit logs |
| GET | `/api/admin/users` | List all users (Admin) |
| GET | `/api/reports` | Generate reports |

---

## Contributors

This project was built collaboratively by:

- **[j-a-y-e-s-h](https://github.com/j-a-y-e-s-h)** (Jayesh Parmar)
- **[kamleshp-iy9](https://github.com/kamleshp-iy9)** (Kamlesh)
- **[YashPatil2023](https://github.com/YashPatil2023)** (Yash Patil)

Built in 24 hours at Hackathon 2026 with ❤️

---

## License

This project is open source and available under the MIT License.

---

## Database Schema Overview

```
User ──────────── Eco ──────────── EcoApproval
                   │
                   ├──────────── AuditLog
                   ├──────────── Attachment
                   └──────────── EcoStage ── ApprovalRule

Product ──────── Bom ──────────── BomComponent
                                └── BomOperation
```

---

## Pushing to GitHub

### First-time push

```bash
# Initialize git (if not already done)
git init

# Add remote origin
git remote add origin https://github.com/your-username/plm-eco-system.git

# Stage all files
git add .

# Create initial commit
git commit -m "Initial commit: PLM ECO System"

# Push to main branch
git push -u origin main
```

### Subsequent pushes

```bash
git add .
git commit -m "your commit message"
git push
```

### Push to a specific branch

```bash
git checkout -b feature/your-feature-name
git add .
git commit -m "feat: your feature description"
git push -u origin feature/your-feature-name
```

---

## License

MIT
