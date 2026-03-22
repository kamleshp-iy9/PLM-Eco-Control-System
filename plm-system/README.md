# PLM — Engineering Change Order System

A complete, production-quality PLM (Product Lifecycle Management) system for managing Engineering Change Orders (ECOs), Products, and Bills of Materials (BoMs).

## Features

- **Authentication**: JWT-based authentication with access and refresh tokens
- **User Management**: Role-based access control (Admin, Engineering User, Approver, Operations User)
- **Product Management**: Create and manage products with versioning
- **Bill of Materials**: Manage BoMs with components and operations
- **Engineering Change Orders**: Full ECO lifecycle from creation to approval
- **Stage Pipeline**: Configurable ECO stages with approval workflows
- **Reporting**: Comprehensive reports on ECOs, products, and BoMs
- **Audit Trail**: Complete audit logging of all changes

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | Node.js + Express.js |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT (access + refresh tokens), bcrypt |
| State Management | Zustand |
| API Style | REST with JSON |

## Quick Start

### Prerequisites

- Node.js >= 18
- PostgreSQL >= 14 (running and accessible)
- npm >= 9

### 1. Clone and Install

```bash
cd plm-system
npm run install:all
```

### 2. Setup Database

Create the database:

```bash
# Via terminal
createdb plm_system

# Or via psql
psql -U postgres -c "CREATE DATABASE plm_system;"
```

### 3. Configure Environment

```bash
cp server/.env.example server/.env
# Edit server/.env with your PostgreSQL credentials
```

### 4. Run Migrations and Seed

```bash
cd server
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
cd ..
```

### 5. Start Development

```bash
npm run dev
```

- Server: http://localhost:5000
- Client: http://localhost:5173

## Demo Credentials

| Role | Login ID | Password |
|------|----------|----------|
| Admin | admin01 | Admin@123 |
| Engineer | engineer01 | Engg@1234 |
| Approver | approver01 | Appr@1234 |
| Operations | ops01 | Opss@1234 |

## Project Structure

```
plm-system/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── stores/         # Zustand stores
│   │   └── lib/            # Utilities
│   └── package.json
├── server/                 # Express backend
│   ├── src/
│   │   ├── controllers/    # Route controllers
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Express middleware
│   │   ├── services/       # Business logic
│   │   └── utils/          # Utilities
│   ├── prisma/
│   │   ├── schema.prisma   # Database schema
│   │   └── seed.js         # Seed data
│   └── package.json
└── package.json
```

## API Endpoints

### Auth
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user
- `POST /api/auth/forgot-password` - Reset password

### Products
- `GET /api/products` - List products
- `GET /api/products/:id` - Get product details
- `GET /api/products/:id/versions` - Get product versions
- `POST /api/products` - Create product

### Bills of Materials
- `GET /api/boms` - List BoMs
- `GET /api/boms/:id` - Get BoM details
- `GET /api/boms/:id/versions` - Get BoM versions
- `POST /api/boms` - Create BoM

### ECOs
- `GET /api/ecos` - List ECOs
- `GET /api/ecos/:id` - Get ECO details
- `POST /api/ecos` - Create ECO
- `PUT /api/ecos/:id` - Update ECO
- `POST /api/ecos/:id/start` - Start ECO
- `POST /api/ecos/:id/approve` - Approve ECO
- `POST /api/ecos/:id/validate` - Validate ECO
- `POST /api/ecos/:id/reject` - Reject ECO
- `GET /api/ecos/:id/diff` - Get ECO diff

### Settings (Admin only)
- `GET /api/settings/stages` - List ECO stages
- `POST /api/settings/stages` - Create stage
- `PUT /api/settings/stages/:id` - Update stage
- `DELETE /api/settings/stages/:id` - Delete stage
- `GET /api/settings/approval-rules` - List approval rules
- `POST /api/settings/approval-rules` - Create approval rule

### Reports
- `GET /api/reports/ecos` - ECO report
- `GET /api/reports/product-versions` - Product version history
- `GET /api/reports/bom-changes` - BoM change history
- `GET /api/reports/archived-products` - Archived products
- `GET /api/reports/active-matrix` - Active product-BoM matrix

## Scripts

```bash
# Install all dependencies
npm run install:all

# Start development (both client and server)
npm run dev

# Database operations
npm run db:migrate    # Run migrations
npm run db:seed       # Seed database
npm run db:reset      # Reset database

# Setup everything
npm run setup         # Install + migrate + seed
```

## ECO Lifecycle

1. **Create**: Engineer creates an ECO with proposed changes
2. **Save**: ECO is saved in draft state
3. **Start**: ECO is started and becomes read-only
4. **Stage Pipeline**: ECO moves through configured stages
5. **Approval**: Required approvers approve the ECO
6. **Apply**: Changes are applied when ECO reaches final stage

## License

MIT
