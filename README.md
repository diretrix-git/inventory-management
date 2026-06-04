# Mini-Mart Inventory Management System

A full-stack internal web application for managing a mini-mart — products, suppliers, orders, invoices, analytics, and staff management.

---

## Features

| Module | What it does |
|---|---|
| **Products** | CRUD with categories, Cloudinary image upload, auto-generated SKUs, low-stock alerts, supplier linking |
| **Suppliers** | Manage supplier directory linked to products |
| **Orders** | Create orders with product grid/cart, Rs 15,000 approval threshold, atomic stock deduction |
| **Invoices** | PDF invoice generation and download for every order |
| **Categories** | Full CRUD for product categories with inline-add from product form |
| **Users** | Admin creates/deactivates staff accounts |
| **Dashboard** | Role-aware stats — admin sees today's revenue, orders, approvals; staff sees task overview |
| **Analytics** | 5-question analytics: sales growth, best/dying products, inventory health, order flow, staff performance |
| **Notifications** | Real-time in-app notifications via Server-Sent Events (SSE) |
| **Email** | Order confirmation to customer + alert to admin via Gmail |
| **Audit Logs** | Filterable log of every system action with user, timestamp, and target |
| **Settings** | Business name, address, tax rate, low-stock threshold |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5.9 |
| Database | MongoDB Atlas + Mongoose 9 |
| Auth | Auth.js v5 (credentials only) |
| Styling | Tailwind CSS 4 + @base-ui/react |
| Charts | Recharts 2 |
| Animations | Framer Motion 12 |
| Tables | TanStack Table v8 |
| Forms | React Hook Form + Zod |
| PDF | @react-pdf/renderer (server-side) |
| Images | Cloudinary (client-side optimization to WebP) |
| Email | Nodemailer (Gmail SMTP) |
| Deployment | Vercel |

---

## Installation

### Prerequisites
- Node.js 20+
- MongoDB Atlas account (free tier works)
- Cloudinary account (optional — for product images)
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

## Folder Structure

```
src/
├── app/
│   ├── (auth)/login/         # Login page
│   ├── (dashboard)/          # All protected pages
│   │   ├── dashboard/        # Home dashboard
│   │   ├── products/         # Product catalog
│   │   ├── suppliers/        # Supplier management
│   │   ├── orders/           # Order management
│   │   ├── invoices/         # Invoice list + PDF
│   │   ├── categories/       # Category CRUD
│   │   ├── analytics/        # Business analytics
│   │   ├── users/            # User management
│   │   ├── profile/          # Profile settings
│   │   ├── audit-logs/       # System audit trail
│   │   └── settings/         # Business settings
│   └── api/                  # 30+ API route handlers
│
├── components/
│   ├── layout/               # Header, Sidebar, NotificationBell
│   ├── shared/               # Reusable UI components
│   │   ├── DataTable.tsx     # TanStack Table wrapper
│   │   ├── ViewModal.tsx     # Row detail modal
│   │   ├── CategorySelect.tsx # Searchable category dropdown
│   │   ├── SupplierSelect.tsx # Supplier dropdown with inline add
│   │   └── CloudinaryUpload.tsx # Drag-and-drop image upload
│   └── orders/OrderForm.tsx  # Order creation form
│
├── lib/
│   ├── db.ts                 # MongoDB connection
│   ├── auth-utils.ts         # requireRole() guard
│   ├── audit.ts              # Audit logging
│   ├── notify.ts             # In-app notifications + SSE
│   ├── email.ts              # Gmail email
│   ├── insights.ts           # Analytics insights engine
│   └── errors.ts             # User-friendly error messages
│
└── models/                   # 9 Mongoose schemas
    User, Product, Supplier, Order, Invoice,
    AuditLog, SystemSettings, Category, Notification
```

---

## Role-Based Access

| Feature | Admin | Staff |
|---|---|---|
| View products, suppliers, orders, invoices | ✅ | ✅ |
| Create/edit/delete products & suppliers | ✅ | ❌ |
| Create orders | ✅ | ✅ |
| Confirm/cancel orders | ✅ | ❌ |
| View analytics, reports, audit logs | ✅ | ❌ |
| Manage users and settings | ✅ | ❌ |
| View dashboard (own view) | ✅ | ✅ |

---

## Order Approval Threshold

Orders totalling **Rs 15,000 or more** require admin confirmation before stock is deducted. This prevents large unverified orders from locking up inventory.

- Below Rs 15,000 → auto-confirmed, stock deducted immediately
- Rs 15,000 and above → stays pending, admin must confirm

---

## Production Deployment (Vercel)

1. Push to GitHub
2. Import repo in [vercel.com](https://vercel.com)
3. Add all environment variables from `.env.local.example`
4. Set `NEXTAUTH_URL` to your production URL
5. Whitelist Vercel IPs in MongoDB Atlas Network Access
6. Deploy

---

## Optional Services Setup

### Cloudinary (Product Images)
1. Create account at [cloudinary.com](https://cloudinary.com)
2. Go to Settings → Upload → Add upload preset
3. Set preset name: `inventory_uploads`, mode: **Unsigned**
4. Add to `.env.local`:
   ```
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=inventory_uploads
   ```

### Gmail Email Notifications
1. Enable 2-Step Verification on your Google account
2. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
3. Create password for "Mail" → copy the 16-character password
4. Add to `.env.local`:
   ```
   GMAIL_USER=your@gmail.com
   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
   ```

---

## Built with ❤️ for a mini-mart in Nepal
