# FixMate | On-Demand Device & Home Appliance Repair Platform

**FixMate** is a full-stack, role-based repair service platform built with Next.js 16 (App Router), Express.js, MongoDB Atlas, Better Auth, JWT, and Stripe.

It connects customers needing device repairs (smartphones, laptops, AC units, refrigerators, TVs, washing machines, and electrical appliances) with verified technicians. FixMate enforces a **pay-after-service model**: customers send requests, track progress through an atomic status pipeline, and pay securely via Stripe only after the technician marks the job completed.

---

## 🔗 Live Deployments

- **Frontend Application:** `https://your-client-domain.vercel.app`
- **Backend API Server:** `https://your-server-domain.vercel.app`
- **API Health Check:** `https://your-server-domain.vercel.app/api/health`

---

## 🔑 Demo & Evaluator Accounts

All seeded demo accounts share the universal password: `Password123!`

| Role | Email | Password | Primary Capabilities |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@fixmate.io` | `Password123!` | Executive KPIs, approve/reject services, manage user roles, global bookings & audit logs |
| **Technician** | `alex.technician@fixmate.io` | `Password123!` | Create & manage services, accept/reject booking requests, update repair status, earnings metrics |
| **Customer** | `sophia.turner@gmail.com` | `Password123!` | Browse services, instant booking, track active repairs, online Stripe checkout & history |

*Additional Seeded Accounts:*
- Technicians: `marcus.technician@fixmate.io`, `david.technician@fixmate.io`
- Customers: `liam.harper@gmail.com`, `emma.watson@gmail.com`

---

## 🌟 Key Features

1. **Role-Based Access Control (RBAC):**
   - Three distinct stakeholder roles (`customer`, `technician`, `admin`).
   - Private route guards in Next.js Server Components with automatic role-boundary redirects.
   - Stateless JWT verification via Better Auth's remote JWKS endpoint and Express middlewares (`verifyToken`, `verifyCustomer`, `verifyTechnician`, `verifyAdmin`).

2. **Server-Side Service Catalog & Filtering (Challenge 1):**
   - Browse services across 7 categories with MongoDB aggregation pipelines.
   - Text search (`q`), category filters, service mode (`Home Visit` vs `Shop Drop-off`), and sorting (`price-asc`, `price-desc`, `newest`, `oldest`).
   - Query parameters survive browser reload via URL search parameters.

3. **Strict Job Status Pipeline & Guards (Challenge 3):**
   - Enforces linear state transitions: `requested` ➔ `accepted` / `rejected` ➔ `in-progress` ➔ `completed`.
   - Technicians and admins are blocked from booking repairs.
   - Technicians cannot book their own services.
   - Customers cannot submit duplicate active requests for the same service.
   - Cancellation permitted strictly while the job is in `requested` status.

4. **Stripe Pay-After-Service & Webhook (Challenge 4):**
   - Stripe Checkout initiated only for `completed` and `unpaid` jobs.
   - Server Derives price strictly from the database (tamper-proof).
   - Idempotent payment fulfillment handles concurrent verifications and Stripe webhook retries with zero duplicate entries.
   - Webhook mounted with raw body parsing before standard JSON middleware.

5. **Server-Side Media Processing:**
   - Dedicated authenticated `/api/upload` route for ImgBB uploads.
   - Server-only API key protection; zero client-side leakage.
   - Strict validation on MIME types (`jpeg`, `png`, `webp`) and payload size (≤ 4 MB).

---

## 📦 Core NPM Packages Used

### Client (`/client`)
- `next` (v16.4.6) — App Router, Server Components & Route Handlers
- `react` & `react-dom` (v19.3.0) — Core UI library
- `better-auth` (v1.7.25) — Authentication engine with MongoDB adapter & JWT plugin
- `mongodb` (v7.9.0) — MongoDB Node.js driver for session persistence
- `tailwindcss` (v4.3.3) — Modern utility-first CSS styling
- `lucide-react` (v1.75.0) — Consistent iconography
- `sonner` (v2.0.8) — Responsive toast notification framework
- `recharts` (v3.11.0) — Dashboard metrics and revenue data visualization
- `react-hook-form` & `zod` — Schema validation and form management

### Server (`/server`)
- `express` — REST API framework
- `mongodb` — Native MongoDB driver for Atlas database operations
- `jose` — Remote JWKS retrieval and cryptographic JWT verification
- `stripe` — Stripe SDK for checkout sessions and webhook verification
- `cors` — Cross-Origin Resource Sharing middleware
- `dotenv` — Environment configuration loader

---

## 🛠️ Project Structure & Setup

```text
fixmate/
├── client/              # Next.js 16 frontend client
│   ├── app/             # App router pages, layouts, and /api routes
│   ├── components/      # UI components, modals, tables, badges
│   ├── lib/             # API client, Better Auth config, data hooks
│   └── scripts/         # Database seeding scripts
├── server/              # Express.js REST backend
│   ├── src/
│   │   ├── config/      # CORS and Stripe SDK initialization
│   │   ├── middlewares/ # JWT auth, role guards, error handlers
│   │   ├── routes/      # services, bookings, payments, admin, users, stats
│   │   └── db.js        # MongoDB client and collection accessors
│   └── api/             # Vercel serverless entrypoint
└── docs/                # Architecture specifications and compliance audit
```

### Quick Start (Local Development)

1. **Install Dependencies:**
   ```bash
   cd client && npm install
   cd ../server && npm install
   ```

2. **Configure Environment Variables:**
   - Copy `client/.env.example` to `client/.env.local`
   - Copy `server/.env.example` to `server/.env`

3. **Seed Database:**
   ```bash
   cd client
   npm run seed
   ```

4. **Run Servers:**
   - Client: `cd client && npm run dev` (starts on `http://localhost:3000`)
   - Server: `cd server && npm run dev` (starts on `http://localhost:5000`)
