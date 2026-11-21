# FixMate - Backend API Server

FixMate API Server is an Express.js REST backend serving the FixMate electronic and appliance repair services platform. It provides high-performance endpoints for public service discovery, role-secured management endpoints (Admin, Technician, Customer), Stripe checkout and webhook handling, and MongoDB aggregation analytics.

---

## 🔗 Live Service
- **Live API URL:** `https://your-server-domain.vercel.app`
- **Frontend Client URL:** `https://your-client-domain.vercel.app`
- **Health Check Endpoint:** `GET /api/health`

---

## 🔑 Demo Credentials

All seeded accounts share the universal password: `Password123!`

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@fixmate.io` | `Password123!` | Full moderation, user role toggles, service approvals, finance logs |
| **Technician** | `alex.technician@fixmate.io` | `Password123!` | Service catalog, booking fulfillment, repair status pipeline |
| **Customer** | `sophia.turner@gmail.com` | `Password123!` | Service bookings, active repair history, Stripe checkout |

---

## 🌟 Key Features & API Modules

1. **Services Module (`/api/services`):**
   - Public curated homepage services (`GET /api/services/home`).
   - Paginated search, category filtering, mode, and multi-sort (`GET /api/services`).
   - Technician service catalog creation, editing, deletion, and toggle availability.
   - Admin service review (pending approval, approve, reject).

2. **Bookings Module (`/api/bookings`):**
   - Customer booking creation, retrieval, cancellation, and payment tracking.
   - Technician request queue (accept, decline, advance status to `in_progress` or `completed`).
   - Admin global booking logs.

3. **Payments & Stripe Module (`/api/payments`):**
   - Stripe Checkout Session creation (`POST /api/payments/create-checkout-session`).
   - Stripe webhook verification (`POST /api/webhook/stripe`) with raw payload handling.
   - Payment status verification and customer receipt records.

4. **Analytics & Aggregations (`/api/stats`):**
   - High-performance MongoDB aggregation pipelines for Customer spending, Technician earnings, and Admin executive metrics.
   - Public trust counters (verified technicians, completed jobs).

5. **Authentication & Security:**
   - Stateless JWT verification with Better Auth's remote JWKS endpoint (`jose`).
   - Authoritative user role inspection directly against MongoDB.
   - Strict CORS configuration supporting configurable client origins.

---

## 📦 Core NPM Packages & Tech Stack

- **Runtime:** Node.js (ES Modules, `"type": "module"`)
- **Web Framework:** Express 4
- **Database:** `mongodb` official driver (MongoDB Atlas)
- **Authentication / JWT:** `jose` (JWKS remote key set verification)
- **Payment Processing:** `stripe`
- **Security:** `cors`, `dotenv`

---

## 🛠️ Local Setup & Development

1. **Navigate to the server directory:**
   ```bash
   cd server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**  
   Create a `.env` file with:
   ```env
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   DB_NAME=fixmate
   CLIENT_URL=http://localhost:3000
   JWKS_URL=http://localhost:3000/api/auth/jwks
   STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```
   Server listens on `http://localhost:5000`.

5. **Verify health:**
   ```bash
   curl http://localhost:5000/api/health
   ```

---

## 🚀 Vercel Deployment Architecture

The server is configured for seamless Vercel Serverless Function deployment via `vercel.json`:
- All requests rewrite to `/src/index.js`.
- The Express app is conditionally run with `app.listen()` only when outside Vercel (`!process.env.VERCEL`), allowing Vercel to cleanly handle HTTP routing via the exported `app`.
