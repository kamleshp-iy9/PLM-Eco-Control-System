# PLM ECO System - Setup & Feature Implementation Guide

## Current Status ✅

Your project has all the necessary components already set up:

### Backend Routes Available:
- ✅ **Auth Routes** (`/api/auth/`)
  - `POST /signup` - User registration
  - `POST /login` - User login
  - `POST /refresh` - Refresh JWT token
  - `GET /me` - Get current user
  - `POST /forgot-password` - Password reset

- ✅ **Product Routes** (`/api/products/`)
- ✅ **BOM Routes** (`/api/boms/`)
- ✅ **ECO Routes** (`/api/ecos/`)
- ✅ **Admin Routes** (`/api/admin/`)
- ✅ **Audit Routes** (`/api/audit/`)
- ✅ **Reports Routes** (`/api/reports/`)
- ✅ **Upload Routes** (`/api/upload/`)

### Frontend Pages Available:
- ✅ LoginPage.tsx - Login form
- ✅ ForgotPasswordPage.tsx - Password recovery
- ✅ AdminUsersPage.tsx - User management
- ✅ ProductsPage.tsx - Product listing
- ✅ BomsPage.tsx - BOM management
- ✅ EcoPage.tsx - ECO management
- ✅ ReportsPage.tsx - Reports generation

---

## Setup Instructions

### 1. **Database Setup** (PostgreSQL)

```bash
# Make sure PostgreSQL is running on localhost:5432
# Database: plm_system
# User: postgres
# Password: root
```

You already have it running! ✅

### 2. **Run Database Migrations**

```bash
cd plm-system
npm run db:migrate
npm run db:seed
```

This will:
- Create all tables (User, Product, BOM, ECO, AuditLog, etc.)
- Create admin user for login
- Set up default ECO workflow stages

### 3. **Environment Variables**

Already configured in `plm-system/server/.env`:
- DATABASE_URL ✅
- JWT_SECRET ✅
- JWT_REFRESH_SECRET ✅
- PORT=5000 ✅
- CLIENT_URL=http://localhost:5173 ✅

### 4. **Start Development Servers**

```bash
cd plm-system

# Start both frontend and backend
npm run dev

# Or separately:
npm run dev:server  # Terminal 1 - Backend on :5000
npm run dev:client  # Terminal 2 - Frontend on :5173
```

---

## Default Login Credentials

After running `npm run db:seed`:

```
Email: admin@plm.com
Password: Admin@123
Role: Admin
```

(Check `plm-system/server/prisma/seed.js` for exact credentials)

---

## Features & How to Use Them

### Login & Authentication
1. Go to `http://localhost:5173`
2. Click "Login"
3. Enter admin email and password
4. You'll be redirected to the dashboard

### User Management (Admin)
- Navigate to Admin → Users
- Create new users
- Assign roles (Admin, Engineering, Approver, Operations)
- Lock/unlock user accounts

### Product Management
1. Create a product with name, description, attachments
2. Assign the product a version
3. Track product lifecycle

### Bill of Materials (BOM)
1. Create BOM from product
2. Add components with quantities
3. Define manufacturing operations
4. Track BOM versions

### Engineering Change Orders (ECO)
1. Raise an ECO (Select product/BOM, describe change)
2. Route through approval workflow
3. Different roles approve at different stages
4. Audit trail tracks all changes
5. Once approved, apply changes to product

### Reports
- **ECO Reports** - Status, timeline, approvals
- **Product Reports** - Versions, BOMs, changes
- **Audit Trail** - Complete history of all actions

---

## Key Features Already Implemented

✅ **Authentication**
- JWT-based (access + refresh tokens)
- Rate limiting on login attempts
- Password reset flow
- Session management

✅ **Real-Time Updates**
- Socket.io integration
- Live notifications for ECO approvals
- Real-time user activity

✅ **Role-Based Access Control**
- Admin: Full access
- Engineering User: Create products/BOMs/ECOs
- Approver: Review and approve ECOs
- Operations User: View and execute approved changes

✅ **Security**
- Helmet headers
- CORS protection
- Rate limiting
- JWT authentication
- Input validation

✅ **File Uploads**
- Upload PDFs, images to products/BOMs/ECOs
- Served from `/api/uploads/`
- 10MB file size limit

✅ **Database**
- PostgreSQL with Prisma ORM
- Migrations support
- Audit logging
- Soft deletes

---

## Next Steps

### 1. **Initialize Database**
```bash
npm run db:migrate
npm run db:seed
```

### 2. **Start Servers**
```bash
npm run dev
```

### 3. **Test Login**
- Open http://localhost:5173
- Login with admin@plm.com / Admin@123
- Explore the system

### 4. **Create Test Data**
- Create a test product
- Create a test BOM
- Raise a test ECO
- Test approval workflow

---

## Troubleshooting

### Issue: "Cannot connect to database"
```bash
# Verify PostgreSQL is running
psql -U postgres -c "SELECT version();"

# Check .env DATABASE_URL is correct
cat plm-system/server/.env | grep DATABASE_URL
```

### Issue: "Port 5000 already in use"
```bash
# Kill process on port 5000
npx kill-port 5000

# Or use a different port in .env
PORT=5001
```

### Issue: Tables don't exist
```bash
# Re-run migrations
npm run db:reset  # Warning: deletes all data
npm run db:migrate
npm run db:seed
```

---

## Available Commands

```bash
cd plm-system

# Development
npm run dev                # Start both servers
npm run dev:server         # Backend only
npm run dev:client         # Frontend only

# Database
npm run db:migrate         # Run migrations
npm run db:seed            # Seed initial data
npm run db:reset           # Reset database (destructive)

# Build
npm run build              # Build frontend for production

# Linting
npm run lint               # Check code quality
```

---

## API Testing

### Login Example
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@plm.com","password":"Admin@123"}'
```

### Create Product Example
```bash
curl -X POST http://localhost:5000/api/products \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Product A","description":"Test product"}'
```

---

## Questions?

Check these files for implementation details:
- `plm-system/server/src/controllers/` - Business logic
- `plm-system/server/src/middleware/` - Auth, validation, rate limiting
- `plm-system/client/src/pages/` - Frontend pages
- `plm-system/server/prisma/schema.prisma` - Database schema

Everything is ready to go! Start the servers and begin exploring! 🚀
