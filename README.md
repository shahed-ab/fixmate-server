# FixMate | On-Demand Device & Home Appliance Repair Platform
<div align="center">

# ⚙️ FixMate — Server

**REST API for the FixMate repair booking platform.**
JWT auth, role-based middlewares, a server-enforced job pipeline, and Stripe payments.

[![Live API](https://img.shields.io/badge/Live_API-fixmate--server--six.vercel.app-0f766e?style=for-the-badge&logo=vercel&logoColor=white)](https://fixmate-server-six.vercel.app/)
[![Client](https://img.shields.io/badge/Client-fixmate--client--ujyn.vercel.app-134e4a?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://fixmate-client-ujyn.vercel.app/)

![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-Auth-000000?logo=jsonwebtokens&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-Test_Mode-635BFF?logo=stripe&logoColor=white)

</div>

---

## 📌 Table of Contents

- [About](#-about)
- [Live Links & Admin Credentials](#-live-links--admin-credentials)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [NPM Packages Used](#-npm-packages-used)
- [Database Design](#-database-design)
- [Security Model](#-security-model)
- [Job Status Pipeline](#-job-status-pipeline)
- [API Reference](#-api-reference)
- [Payment Flow](#-payment-flow)
- [Environment Variables](#-environment-variables)
- [Getting Started](#-getting-started)
- [Deployment](#-deployment)
- [Related Repository](#-related-repository)
- [Author](#-author)

---

## 📖 About

This is the backend of **FixMate**, a role-based platform where **Customers** book repairs, **Technicians** list services and run jobs, and **Admins** moderate the marketplace. The API owns all business rules: nothing important is trusted from the client.

Health check: `GET /` → `{"success":true,"message":"FixMate API Server is running"}`

---

## 🌐 Live Links & Admin Credentials

| Resource | Link |
| --- | --- |
| 🚀 Live API | https://fixmate-server-six.vercel.app/ |
| 🖥️ Live Client | https://fixmate-client-ujyn.vercel.app/ |

> ⚠️ Replace with your real seeded admin account before publishing.

| Role | Email | Password |
| --- | --- | --- |
| 👑 Admin | `admin@fixmate.com` | `YourAdminPassword` |

**Stripe test card:** `4242 4242 4242 4242`

---

## ✨ Key Features

- 🔐 **JWT verification** with custom role middlewares: `verifyToken`, `verifyCustomer`, `verifyTechnician`, `verifyAdmin`
- 🚦 `401 Unauthorized` for missing/invalid tokens, `403 Forbidden` for wrong role
- 🧱 **Ownership checks**: a user can only reach their own data, even if they change an email in the URL
- 🔄 **Server-enforced status pipeline**: invalid transitions are rejected
- 🔍 **Server-side search, filter & sort** powered by MongoDB queries
- 🚫 **Duplicate active-request prevention** per customer and service
- 💳 **Stripe Checkout** with amounts always loaded from the database, never from the client
- 🪝 **Stripe Webhook** + success-page verification, **idempotent** so a payment is never saved twice
- 🛡️ Signup role sanitization: anything other than `customer` or `technician` is saved as `customer`
- 🌱 Seed data for technicians, 12+ approved services, and bookings in multiple statuses

---

## 🧰 Tech Stack

| Area | Technology |
| --- | --- |
| Runtime | Node.js |
| Framework | Express.js |
| Database | MongoDB |
| Authentication | JWT + BetterAuth session on the client |
| Payments | Stripe (Checkout + Webhook, test mode) |
| Media | ImgBB (uploaded from the client) |
| Deployment | Vercel |

---

## 📦 NPM Packages Used

> ⚠️ Compare with your `package.json` and make this list exact.

| Package | Purpose |
| --- | --- |
| `express` | Web framework |
| `mongodb` | MongoDB driver |
| `cors` | Cross-origin configuration |
| `dotenv` | Environment variables |
| `jsonwebtoken` | JWT signing & verification |
| `stripe` | Stripe Checkout & webhooks |
| `nodemon` *(dev)* | Auto-restart in development |

---

## 🗄️ Database Design

FixMate uses **4 collections** of its own. BetterAuth additionally creates `session`, `account` and `verification` collections automatically; its `user` collection serves as `users`.

| Collection | Purpose |
| --- | --- |
| `users` | Every user, their role, and profile info (`role`, `phone`, `area`, `bio`) |
| `services` | Repair services offered by technicians, with approval status and availability |
| `bookings` | Every repair request and its status, final amount, and payment status |
| `payments` | One payment record per paid job |

```
users ──(technicianEmail)──► services ──(serviceId)──► bookings ──(bookingId)──► payments
  └────────────(customerEmail / technicianEmail)──────────┘
```

Booking documents copy service and technician details at request time, so a booking still displays correctly if the service is later edited or deleted. `payments.stripeSessionId` is unique to guarantee a payment is stored only once.

---

## 🛡️ Security Model

| Layer | What it does |
| --- | --- |
| `verifyToken` | Validates the JWT. Missing or invalid token → **401** |
| `verifyCustomer` | Requires role `customer`. Wrong role → **403** |
| `verifyTechnician` | Requires role `technician`. Wrong role → **403** |
| `verifyAdmin` | Requires role `admin`. Wrong role → **403** |
| Ownership check | Queries always use the email from the verified token, never from the URL or body |
| Secrets | MongoDB, JWT, ImgBB, and Stripe credentials live in `.env` only |

---

## 🚦 Job Status Pipeline

| Current | Next | Who | Rule |
| --- | --- | --- | --- |
| `requested` | `accepted` | Technician (owner) | — |
| `requested` | `rejected` | Technician (owner) | Final state |
| `requested` | `cancelled` | Customer (owner) | Final state |
| `accepted` | `in-progress` | Technician (owner) | — |
| `in-progress` | `completed` | Technician (owner) | `finalAmount` must be a number > 0 |
| `completed` + `unpaid` | `paid` | Stripe | Only once per booking |

Any other transition (for example `requested → completed`, or editing a `cancelled` job) is rejected by the server.

**Business rules**
- A customer cannot hold two active requests (`requested`, `accepted`, `in-progress`) for the same service
- Technicians and admins cannot create bookings
- A technician cannot book their own service
- Payment is possible only for a `completed` + `unpaid` booking owned by the logged-in customer

---

## 📡 API Reference

> ⚠️ Verify the paths against your route files and adjust if any differ.

### Public

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/` | Health check |
| `GET` | `/api/services` | Approved & available services. Supports `search`, `category`, `serviceMode`, `sort`, and `limit` query params |
| `GET` | `/api/services/:id` | Single approved service |

### Customer — `verifyToken` + `verifyCustomer`

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/bookings` | Create a repair request |
| `GET` | `/api/bookings/my` | List own bookings |
| `PATCH` | `/api/bookings/:id/cancel` | Cancel while `requested` |
| `POST` | `/api/payments/create-checkout-session` | Start Stripe Checkout for a completed, unpaid booking |
| `GET` | `/api/payments/verify?session_id=` | Verify Stripe session and save the payment |
| `GET` | `/api/payments/my` | Own payment history |

### Technician — `verifyToken` + `verifyTechnician`

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/services` | Add a service (`pending`) |
| `GET` | `/api/services/my` | List own services |
| `PATCH` | `/api/services/:id` | Update a service (resets to `pending`) |
| `DELETE` | `/api/services/:id` | Delete a service |
| `GET` | `/api/bookings/technician` | Jobs assigned to this technician |
| `PATCH` | `/api/bookings/:id/status` | Move a job through the pipeline |

### Admin — `verifyToken` + `verifyAdmin`

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/admin/users` | All users |
| `PATCH` | `/api/admin/users/:id/role` | Change a user's role (not your own) |
| `GET` | `/api/admin/services` | All services |
| `PATCH` | `/api/admin/services/:id/approval` | Approve or reject a service |
| `GET` | `/api/admin/bookings` | All bookings |
| `GET` | `/api/admin/payments` | All transactions |

### Authenticated (any role) — `verifyToken`

| Method | Endpoint | Description |
| --- | --- | --- |
| `PATCH` | `/api/users/profile` | Update name, phone, area, bio, image |

### Webhook

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/payments/webhook` | Stripe webhook. Uses the raw body and signing-secret verification |

### Search & Sort Example

```
GET /api/services?search=iphone&category=Smartphone&serviceMode=Home%20Visit&sort=price-asc
```

---

## 💳 Payment Flow

1. Customer clicks **Pay Now**. The client calls `POST /api/payments/create-checkout-session` with only the `bookingId`.
2. The server loads the booking, checks ownership, `completed` status, and `unpaid` state, then creates a Checkout Session with `unit_amount = finalAmount × 100`. `bookingId` and `customerEmail` go into the session metadata.
3. The customer pays on Stripe and lands on `/payment/success?session_id=...`.
4. The client calls `GET /api/payments/verify`. The server retrieves the session, and if `payment_status === 'paid'` it inserts the payment and marks the booking `paid`.
5. The webhook handles the same event as a safety net. A unique `stripeSessionId` and an already-paid check make both paths **idempotent**.

---

## 🔐 Environment Variables

Create a `.env` file in the project root:

```env
PORT=5000

# MongoDB
MONGODB_URI=your_mongodb_connection_string
DB_NAME=fixmate

# JWT
JWT_SECRET=your_jwt_secret

# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx

# ImgBB
IMGBB_API_KEY=your_imgbb_api_key

# URLs
CLIENT_URL=http://localhost:3000
```

> Never commit `.env`. Variable names must match the ones used in your code.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB Atlas (or local MongoDB)
- Stripe account (test mode) and the Stripe CLI for local webhooks

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/fixmate-server.git
cd fixmate-server

# 2. Install dependencies
npm install

# 3. Add environment variables
cp .env.example .env   # then fill in your values

# 4. Start the server
npm run dev
```

The API runs at [http://localhost:5000](http://localhost:5000).

### Test the webhook locally

```bash
stripe listen --forward-to localhost:5000/api/payments/webhook
```

Copy the printed `whsec_...` value into `STRIPE_WEBHOOK_SECRET`.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start with nodemon |
| `npm start` | Start in production |

---

## ☁️ Deployment

Deployed on **Vercel**.

1. Add all `.env` variables in the Vercel project settings.
2. Add the production client domain (`https://fixmate-client-ujyn.vercel.app`) to the **CORS allowed origins**.
3. In the Stripe Dashboard (test mode), add the webhook endpoint `https://fixmate-server-six.vercel.app/api/payments/webhook` and copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Redeploy and confirm the health check responds.

---

## 🔗 Related Repository

**🖥️ FixMate Client (Next.js + BetterAuth):** https://github.com/YOUR_USERNAME/fixmate-client

---

## 👨‍💻 Author

**Your Name**
- GitHub: [@YOUR_USERNAME](https://github.com/YOUR_USERNAME)
- LinkedIn: [your-linkedin](https://linkedin.com/in/your-linkedin)
- Portfolio: [your-portfolio.com](https://your-portfolio.com)

---

<div align="center">

⭐ If you like this project, please give it a star!

</div>
