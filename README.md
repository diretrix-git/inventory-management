# Mini-Mart Inventory Management System

A full-stack internal web application for managing a mini-mart — products, suppliers, orders, invoices, analytics, and staff management.

---

## Features

| Module | What it does |
|---|---|
| **Products** | CRUD with required category/supplier, Cloudinary image upload (WebP optimized), auto-generated SKUs (read-only after creation), low-stock alerts, **CSV bulk import** |
| **Suppliers** | Full CRUD — name, contact person (required), phone (required), email/address optional; inline-add from product form |
| **Categories** | Full CRUD stored in MongoDB; inline-add from product form |
| **Orders** | Product grid/cart UI, Rs 15,000 approval threshold, atomic stock deduction, email notifications |
| **Invoices** | Auto-generated per order; PDF download; email to customer |
| **Users** | Admin creates/deactivates staff; account lockout after 5 failed logins (15 min); admin can unlock |
| **Dashboard** | Role-aware — Admin: today's revenue/orders/approvals/low-stock; Staff: sales/pending/quick actions |
| **Analytics** | 5-section analytics: sales growth, best/dying products, inventory health, order flow, staff performance |
| **Reports** | Inventory report + Sales report with date range and CSV export |
| **Notifications** | Real-time SSE in-app + Gmail email on order events |
| **Audit Logs** | Every mutation logged — filterable by action type and date range |
| **Settings** | Business name, address, tax rate, low-stock threshold |

---

## Security

- **Brute-force protection:** Account locks after 5 consecutive failed login attempts (15 minutes)
- **Rate limiting:** Max 10 login attempts per IP per 60 seconds
- **Password hashing:** bcrypt 12 rounds
- **JWT sessions:** HttpOnly cookie, 24-hour expiry
- **Role-based access:** 3 layers — middleware, API guard (`requireRole`), UI rendering
- **No OAuth** — all accounts created by admin only

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5.9 |
| Database | MongoDB Atlas + Mongoose 9 |
| Auth | Auth.js v5 (credentials only, no OAuth) |
| Styling | Tailwind CSS 4 + @base-ui/react |
| Charts | Recharts 2 |
| Animations | Framer Motion 12 |
| Tables | TanStack Table v8 |
| Forms | React Hook Form + Zod |
| PDF | @react-pdf/renderer (server-side only) |
| Images | Cloudinary (browser-side resize → WebP, max 300KB) |
| Email | Nodemailer 7 (Gmail SMTP) |
| Real-time | Server-Sent Events (SSE, built into Next.js) |
| Deployment | Vercel |

---

## Installation

### Prerequisites
- Node.js 20+
- MongoDB Atlas account (free tier works)
- Cloudinary account (optional — for product/profile images)
- Gmail App Password (optional — for email notifications)

### 1. Clone and install
```bash
git clone https://github.com/diretrix-git/inventory-management.git
cd inventory-management
npm install
```

### 2. Configure environment
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your values:
```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/inventory
NEXTAUTH_SECRET=any-random-32-char-string
NEXTAUTH_URL=http://localhost:3000
SEED_ADMIN_EMAIL=admin@yourstore.com
SEED_ADMIN_PASSWORD=YourSecurePassword123!
SEED_ADMIN_NAME=Store Admin
```

### 3. Create the first admin account
```bash
npm run seed
```

### 4. Start development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with your seed credentials.

---

## Demo Credentials

> After running `npm run seed` with default `.env.local.example` values:

| Field | Value |
|---|---|
| Email | `admin@example.com` |
| Password | `Admin123!` |
| Role | Admin |

---

## Scripts

| Script | Command | Purpose |
|---|---|---|
| Dev server | `npm run dev` | Start development server |
| Build | `npm run build` | Build for production |
| Seed admin | `npm run seed` | Create first admin account |
| Seed electronics | `npx tsx --env-file=.env.local scripts/seed-electronics.ts` | Load 53 sample electronics products |
| Unlock accounts | `npx tsx --env-file=.env.local scripts/unlock-all.ts` | Clear all account lockouts (use if locked out) |

---

## Folder Structure

```
src/
├── app/
│   ├── (auth)/login/          # Login page with rate limit handling
│   ├── (dashboard)/           # All protected pages
│   │   ├── dashboard/         # Role-aware home dashboard
│   │   ├── products/          # Product catalog + CSV import
│   │   ├── suppliers/         # Supplier management
│   │   ├── orders/            # Order management + approval workflow
│   │   ├── invoices/          # Invoice list + PDF download
│   │   ├── categories/        # Category CRUD
│   │   ├── analytics/         # 5-section business analytics
│   │   ├── users/             # User management + unlock
│   │   ├── profile/           # Profile settings + avatar
│   │   ├── audit-logs/        # Filterable system audit trail
│   │   ├── inventory-report/  # Full stock report + CSV export
│   │   ├── sales-report/      # Sales by date range + CSV export
│   │   └── settings/          # Business configuration
│   └── api/                   # 35+ API route handlers
│       ├── auth/check-login/  # Pre-validates credentials (shows real error messages)
│       ├── products/import/   # CSV bulk import endpoint
│       └── users/[id]/unlock/ # Admin unlock locked account
│
├── components/
│   ├── layout/                # Header, Sidebar, NotificationBell, MobileLayoutShell
│   ├── shared/                # 14 reusable UI components
│   │   ├── DataTable.tsx      # Sortable, searchable, fuzzy-search table
│   │   ├── ViewModal.tsx      # Row-click detail modal with animation
│   │   ├── CategorySelect.tsx # Searchable dropdown + inline add
│   │   ├── SupplierSelect.tsx # Supplier dropdown + inline add
│   │   ├── CloudinaryUpload.tsx # Drag-and-drop + client-side WebP optimization
│   │   ├── PasswordInput.tsx  # Password field with show/hide toggle
│   │   └── CsvImport.tsx     # (in products/) CSV upload modal
│   └── orders/OrderForm.tsx   # Full order creation with product grid
│
├── lib/
│   ├── db.ts                  # MongoDB cached connection
│   ├── auth-utils.ts          # requireRole() API guard
│   ├── audit.ts               # Fire-and-forget audit logging
│   ├── notify.ts              # DB notification + SSE push
│   ├── email.ts               # Gmail SMTP via Nodemailer
│   ├── insights.ts            # Rule-based analytics insights
│   ├── errors.ts              # friendlyError() — user-readable messages
│   └── order-utils.ts         # Order/invoice number generation
│
└── models/                    # 9 Mongoose schemas
    ├── User.ts                # + loginAttempts, lockedUntil fields
    ├── Product.ts             # category + supplierId REQUIRED
    ├── Supplier.ts            # contactPerson + phone REQUIRED
    ├── Order.ts               # + requiresApproval, customerEmail
    ├── Invoice.ts
    ├── AuditLog.ts
    ├── SystemSettings.ts      # Singleton
    ├── Category.ts
    └── Notification.ts
```

---

## Role-Based Access

| Feature | Admin | Staff |
|---|---|---|
| View products, suppliers, orders, invoices | ✅ | ✅ |
| Create/edit/delete products, categories, suppliers | ✅ | ❌ |
| Import products via CSV | ✅ | ❌ |
| Create orders | ✅ | ✅ |
| Confirm/cancel orders | ✅ | ❌ |
| View analytics, reports, audit logs | ✅ | ❌ |
| Manage users (create, deactivate, unlock) | ✅ | ❌ |
| Change system settings | ✅ | ❌ |
| View own dashboard | ✅ (business KPIs) | ✅ (task-focused) |

---

## Order Approval Threshold

Orders totalling **Rs 15,000 or more** require admin confirmation before stock is deducted.

- Below Rs 15,000 → auto-confirmed, stock deducted immediately
- Rs 15,000 and above → stays pending, admin must confirm, stock deducted on approval

---

## Security Details

| Protection | Implementation |
|---|---|
| Brute-force (IP) | Middleware: max 10 attempts per IP per 60s → HTTP 429 |
| Brute-force (account) | 5 failures → 15-min lockout stored in MongoDB |
| Remaining attempts | Shown to user: "4 attempts remaining before lockout" |
| Lockout message | Shows exact minutes remaining |
| Admin unlock | Users page → 🔓 button on locked accounts; or run `scripts/unlock-all.ts` |
| Password storage | bcrypt, 12 rounds |
| Session | JWT in HttpOnly cookie, 24-hour expiry |

---

## Production Deployment (Vercel)

1. Push to GitHub
2. Import repo in [vercel.com](https://vercel.com)
3. Add all environment variables from `.env.local.example`
4. Set `NEXTAUTH_URL` to your production URL
5. Whitelist Vercel IPs in MongoDB Atlas Network Access (`0.0.0.0/0` for simplicity)
6. Deploy

---

## Optional Services Setup

### Cloudinary (Product & Profile Images)
1. Create account at [cloudinary.com](https://cloudinary.com)
2. Settings → Upload → Add upload preset
3. Name: `inventory_uploads`, mode: **Unsigned**
4. Add to `.env.local`:
   ```
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=inventory_uploads
   ```

### Gmail Email Notifications
1. Enable 2-Step Verification on your Google account
2. [Google App Passwords](https://myaccount.google.com/apppasswords) → Create for "Mail"
3. Add to `.env.local`:
   ```
   GMAIL_USER=your@gmail.com
   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
   ```

---

## Built with ❤️ for a mini-mart in Nepal
