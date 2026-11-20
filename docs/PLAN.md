# FixMate Architecture & Implementation Plan

## 1 Roles & Permission Matrix
| Capability | Guest | Customer | Technician | Admin |
| :--- | :---: | :---: | :---: | :---: |
| Browse approved services, view service details, read about page | Yes | Yes | Yes | Yes |
| Register as Customer or Technician (Admin created via seed) | Yes | No | No | No |
| Submit repair request (address, phone, date, problem description) | No | Yes | No | No |
| Cancel own repair request (while status is strictly `requested`) | No | Yes | No | No |
| View own bookings and status updates | No | Yes | No | No |
| Pay for completed repair job via Stripe Checkout & view history | No | Yes | No | No |
| Create repair service (saved as `approvalStatus: 'pending'`) | No | No | Yes | No |
| Manage own services (update -> pending, delete, toggle availability) | No | No | Yes | No |
| Manage assigned requests (Accept, Reject, Start Work, Mark Completed) | No | No | Yes | No |
| Set `finalAmount` upon marking job completed | No | No | Yes | No |
| Moderate services (Approve / Reject any service) | No | No | No | Yes |
| Manage users & update user roles (cannot change own role) | No | No | No | Yes |
| View all platform bookings and Stripe transactions / revenue | No | No | No | Yes |
| Update profile (name, phone, area, bio, ImgBB avatar) | No | Yes | Yes | Yes |

## 2 Route Map (Public / Private / Dashboard)
- **Public Routes (Public Layout: Navbar + Main + Footer with X logo)**:
  - `/` - Home Page (Hero, 6 Latest Featured Services, How It Works, Popular Categories & Trust)
  - `/services` - Browse Services (Server Search, Category & Service Mode Filters, Sort, Grid)
  - `/services/[id]` - Service Details & Customer Repair Request Form Modal
  - `/about` - How It Works & About FixMate
  - `/sign-in` & `/sign-up` - Auth pages (redirect to role dashboard if authenticated)
  - `404` / `[...not-found]` - Custom Not Found Page with repair theme & Back to Home
- **Private Routes - Customer**:
  - `/payment/success` - Verify Stripe session & display receipt (Customer access)
  - `/payment/cancel` - Payment cancellation feedback & retry button (Customer access)
  - `/dashboard/customer` - Customer Overview (Stats: Total Requests, Active Jobs, Completed Jobs)
  - `/dashboard/customer/bookings` - My Bookings (Status tracker, Cancel, Pay Now button)
  - `/dashboard/customer/payments` - Payment History Table (Stripe transactions)
- **Private Routes - Technician**:
  - `/dashboard/technician` - Technician Overview (Stats: Total Services, Approved, Pending Requests)
  - `/dashboard/technician/add-service` - Add Service Form with ImgBB file upload
  - `/dashboard/technician/my-services` - Manage Services (Full CRUD & Availability toggle)
  - `/dashboard/technician/requests` - Manage Requests (Accept, Reject, In-Progress, Complete modal)
- **Private Routes - Admin**:
  - `/dashboard/admin` - Admin Overview (Stats: Total Users, Total Technicians, Pending Services)
  - `/dashboard/admin/users` - Manage Users (User list & role modification)
  - `/dashboard/admin/services` - Service Moderation (Approve / Reject pending listings)
  - `/dashboard/admin/bookings` - All Bookings Monitor (Read-only status log)
  - `/dashboard/admin/transactions` - All Payments & Revenue aggregation
- **Private Routes - Shared**:
  - `/dashboard/profile` - Profile Settings (Update Name, Phone, Area, Bio, Photo via ImgBB)

## 3 The 4 Collection Schemas with Indexes
1. `users` (BetterAuth default user collection + additionalFields):
   - Fields: `_id` (ObjectId), `name` (String), `email` (String, unique), `image` (String), `role` ('customer'|'technician'|'admin', default 'customer'), `phone` (String), `area` (String), `bio` (String), `createdAt` (Date).
   - Indexes: `{ email: 1 }` (unique), `{ role: 1 }`.
2. `services`:
   - Fields: `_id` (ObjectId), `title` (String), `category` (String: Smartphone|Laptop & PC|AC|Refrigerator|TV|Washing Machine|Electrical), `description` (String), `image` (String), `basePrice` (Number), `estimatedDuration` (String), `serviceMode` ('Home Visit'|'Shop Drop-off'), `serviceArea` (String), `technicianName` (String), `technicianEmail` (String), `approvalStatus` ('pending'|'approved'|'rejected', default 'pending'), `isAvailable` (Boolean, default true), `createdAt` (Date).
   - Indexes: `{ approvalStatus: 1, isAvailable: 1, createdAt: -1 }`, `{ technicianEmail: 1 }`, `{ category: 1 }`, `{ title: "text", category: "text" }`.
3. `bookings`:
   - Fields: `_id` (ObjectId), `serviceId` (String), `serviceTitle` (String), `serviceImage` (String), `category` (String), `basePrice` (Number), `technicianName` (String), `technicianEmail` (String), `customerName` (String), `customerEmail` (String), `customerPhone` (String), `address` (String), `preferredDate` (Date), `problemDescription` (String), `status` ('requested'|'accepted'|'rejected'|'in-progress'|'completed'|'cancelled', default 'requested'), `finalAmount` (Number, default = basePrice), `paymentStatus` ('unpaid'|'paid', default 'unpaid'), `createdAt` (Date).
   - Indexes: `{ customerEmail: 1, createdAt: -1 }`, `{ technicianEmail: 1, status: 1 }`, `{ serviceId: 1, customerEmail: 1, status: 1 }`.
4. `payments`:
   - Fields: `_id` (ObjectId), `bookingId` (String), `serviceTitle` (String), `customerName` (String), `customerEmail` (String), `technicianName` (String), `technicianEmail` (String), `amount` (Number), `currency` (String, 'usd'), `transactionId` (String), `stripeSessionId` (String, unique), `paymentStatus` (String, 'paid'), `paidAt` (Date).
   - Indexes: `{ stripeSessionId: 1 }` (unique), `{ bookingId: 1 }` (unique), `{ customerEmail: 1 }`, `{ technicianEmail: 1 }`.

## 4 Full API List
| Method | Path | Middlewares | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/services` | Public | Fetch approved & available services with server search, filter & sort |
| `GET` | `/api/services/my` | `verifyToken`, `verifyTechnician` | Fetch services created by the logged-in technician (declared before `/:id`) |
| `GET` | `/api/services/:id` | Public | Fetch single service details by ID |
| `POST` | `/api/services` | `verifyToken`, `verifyTechnician` | Create a new service (sets `approvalStatus: 'pending'`) |
| `PATCH` | `/api/services/:id` | `verifyToken`, `verifyTechnician` | Update own service (resets `approvalStatus: 'pending'`) |
| `PATCH` | `/api/services/:id/availability` | `verifyToken`, `verifyTechnician` | Toggle `isAvailable` boolean for own service (does NOT reset approvalStatus) |
| `DELETE` | `/api/services/:id` | `verifyToken`, `verifyTechnician` | Delete own service with confirmation |
| `POST` | `/api/bookings` | `verifyToken`, `verifyCustomer` | Create booking (checks active duplicate: requested/accepted/in-progress) |
| `GET` | `/api/bookings/my` | `verifyToken`, `verifyCustomer` | Get all bookings of the logged-in customer |
| `PATCH` | `/api/bookings/:id/cancel` | `verifyToken`, `verifyCustomer` | Cancel booking (allowed only if status === 'requested') |
| `GET` | `/api/bookings/technician` | `verifyToken`, `verifyTechnician` | Get all incoming bookings assigned to logged-in technician |
| `PATCH` | `/api/bookings/:id/status` | `verifyToken`, `verifyTechnician` | Update job status pipeline; requires `finalAmount` when status becomes `completed` |
| `POST` | `/api/payments/create-checkout-session` | `verifyToken`, `verifyCustomer` | Create Stripe Checkout Session (`unit_amount = finalAmount * 100`) |
| `GET` | `/api/payments/verify` | `verifyToken`, `verifyCustomer` | Verify session_id & fulfill payment idempotently |
| `GET` | `/api/payments/my` | `verifyToken`, `verifyCustomer` | Fetch payment history for the logged-in customer |
| `POST` | `/api/webhook/stripe` | Raw body parser (express.raw) | Stripe webhook listener running shared idempotent fulfillment |
| `GET` | `/api/customer/stats` | `verifyToken`, `verifyCustomer` | Customer overview cards and activity stats |
| `GET` | `/api/technician/stats` | `verifyToken`, `verifyTechnician` | Technician overview cards and job metrics |
| `GET` | `/api/admin/users` | `verifyToken`, `verifyAdmin` | List all platform users |
| `PATCH` | `/api/admin/users/:id/role` | `verifyToken`, `verifyAdmin` | Change user role (forbidden to change own role) |
| `GET` | `/api/admin/services` | `verifyToken`, `verifyAdmin` | Fetch all platform services for moderation table |
| `PATCH` | `/api/admin/services/:id/approval` | `verifyToken`, `verifyAdmin` | Moderate service: set `approvalStatus` to 'approved' or 'rejected' |
| `GET` | `/api/admin/bookings` | `verifyToken`, `verifyAdmin` | View all platform bookings (read-only monitoring) |
| `GET` | `/api/admin/payments` | `verifyToken`, `verifyAdmin` | View all payments and platform revenue aggregation |
| `GET` | `/api/admin/stats` | `verifyToken`, `verifyAdmin` | Admin dashboard overview metrics and platform stats |
| `PATCH` | `/api/users/profile` | `verifyToken` | Update logged-in user profile (name, phone, area, bio, image) |

### Job Status Pipeline (strict)
- requested -> accepted | rejected: technician who owns the job (booking.technicianEmail === req.user.email)
- requested -> cancelled: customer who owns the booking (booking.customerEmail === req.user.email)
- accepted -> in-progress: owning technician
- in-progress -> completed: owning technician; body must include finalAmount (number > 0)
- Final states, no further change: rejected, cancelled. Completed can only change paymentStatus.
- "Paid" is NOT a status. It is paymentStatus unpaid -> paid, set ONLY by the Stripe flow (verify endpoint or webhook), once per booking, only when status=completed.
- Any other transition returns 400. Wrong owner or role returns 403. Missing booking or invalid id returns 404.
- Implement with one transition map plus an atomic updateOne filtered by _id AND current status.

## 5 Client Page and Component Tree
- `RootLayout` (`Navbar`, `ToastProvider`, `Footer`)
  - `Navbar`: `BrandLogo`, `NavLinks`, `ThemeToggle`, `UserAvatarDropdown` (Name, RoleBadge, DashboardLink, ProfileLink, SignOut), `MobileHamburger`
  - `Footer`: `BrandInfo`, `QuickLinks`, `CategoryLinks`, `ContactInfo`, `SocialLinks` (X Logo)
  - Public Pages:
    - `/` (Home): `HeroSection` (SearchInput, CTA), `FeaturedServices` (6 ServiceCards), `HowItWorks` (4-step visual), `PopularCategories` & `TrustStats`
    - `/services` (Browse): `SearchFilterBar`, `CategoryTabs`, `ModeFilter`, `SortDropdown`, `ServiceGrid`, `EmptyState`, `Pagination`
    - `/services/[id]` (Details): `ServiceImage`, `ServiceInfo`, `TechnicianCard`, `RequestRepairButton`, `BookingModal` (Phone, Address, Date, Problem description)
    - `/about`: `MissionSection`, `StepByStepGuide`, `FAQAccordion`
    - `/sign-in` & `/sign-up`: `AuthCard`, `RoleCardSelector` (Customer/Technician), `ValidatedInputs`, `PasswordRuleHints`
    - `/payment/success` & `/payment/cancel`: `ResultStatusCard`, `ReceiptSummary`, `ActionButtons`
- `DashboardLayout` (`TopBar`, `Sidebar`, `ContentArea`)
  - `Sidebar`: Role-based menu links (Customer / Technician / Admin), CollapseToggle
  - `TopBar`: PageTitle, `UserAvatar`, `RoleBadge`, `HomeBreadcrumb`
  - Customer Views:
    - `CustomerOverview`: `StatsCards` (Total Requests, Active Jobs, Completed Jobs)
    - `MyBookings`: `BookingsTable`, `StatusBadge`, `PaymentBadge`, `CancelConfirmModal`, `PayNowButton`
    - `PaymentHistory`: `PaymentsTable`, `TransactionIdCopy`, `DateFormatted`
  - Technician Views:
    - `TechnicianOverview`: `StatsCards` (Total Services, Approved Services, Pending Requests)
    - `AddService`: `ServiceForm`, `ImgBBUploader` (drag/drop + preview), `CategoryDropdown`, `ServiceModeToggle`
    - `MyServices`: `ServicesTable`, `ApprovalBadge`, `AvailabilityToggle`, `EditServiceModal`, `DeleteModal`
    - `ManageRequests`: `StatusFilterTabs`, `RequestsTable`, `ActionButtons` (Accept/Reject, Start Work, Mark Completed + `FinalAmountModal`)
  - Admin Views:
    - `AdminOverview`: `StatsCards` (Total Users, Technicians, Pending Services, Revenue)
    - `ManageUsers`: `UsersTable`, `RoleSelectDropdown` (disabled on self)
    - `ServiceApprovals`: `ApprovalFilterTabs`, `ServiceModerationCard/Table`, `ApproveBtn`, `RejectBtn`
    - `AllBookings`: `BookingsMonitorTable`, `StatusFilter`
    - `Transactions`: `RevenueMetricHeader`, `TransactionsTable`
  - Shared View:
    - `/dashboard/profile`: `ProfileForm`, `ImgBBAvatarUpload`, `EmailReadOnly`, `RoleBadgeReadOnly`

## 6 Design Tokens taken from @design/FixMate - Home Page.png
- **Colors**:
  - Primary Brand Teal: `#0F766E` (Teal-700), Hover: `#0D6D65`, Active: `#08544E`, Muted Tint: `#F0FDFA` (Teal-50)
  - Neutral Dark / Text Primary: `#181818` / `#1F2937` (Charcoal / Slate-900)
  - Canvas Background: `#F7F5F0` (Warm Sand / Stone Cream); Card Surfaces: `#FFFFFF`
  - Muted Borders: `#E5E2DA` / `#E5E7EB`; Text Muted: `#6B7280` / `#71717A`
  - Footer Dark: `#1E201E` / `#30312E` with On-Dark Text: `#F3F4F6`
  - Status Badges:
    - Requested: Blue (`bg-blue-50 text-blue-700 border-blue-200`)
    - Accepted: Indigo (`bg-indigo-50 text-indigo-700 border-indigo-200`)
    - In Progress: Amber (`bg-amber-50 text-amber-700 border-amber-200`)
    - Completed: Emerald (`bg-emerald-50 text-emerald-700 border-emerald-200`)
    - Rejected / Cancelled: Rose / Gray (`bg-rose-50 text-rose-700 border-rose-200`)
    - Paid: Teal (`bg-teal-50 text-teal-700 border-teal-200`)
- **Fonts**:
  - Family: Modern Sans-Serif (`Inter` / `Plus Jakarta Sans`)
  - Headings: `font-bold` / `font-semibold`, tracking-tight, `#181818`
  - Body: `font-normal`, leading-relaxed, `#374151`
- **Border Radius**:
  - Buttons & Inputs: `rounded-lg` (8px) / `rounded-xl` (12px)
  - Cards & Modals: `rounded-2xl` (16px)
  - Badges & Pills: `rounded-full` (9999px)
- **Shadows**: Card `shadow-sm` on rest, `shadow-md` on hover with crisp 1px borders (`#E5E2DA`).

## 7 Auth Flow
1. **Client Setup**: Next.js client uses `@better-auth/react` with the `jwtClient()` and `inferAdditionalFields()` plugins.
2. **Session & Token Retrieval**: Upon login via BetterAuth, the client retrieves the session token (`session.data.token`).
3. **API Request**: Client sends the JWT in the header: `Authorization: Bearer <token>`.
4. **JWKS Verification in Express**:
   - At startup, Express initializes verifier: `JWKS = createRemoteJWKSet(new URL(`${CLIENT_URL}/api/auth/jwks`))`.
   - `verifyToken` middleware parses header and verifies signature using `jose.jwtVerify(token, JWKS)`.
5. **Database Role Enforcement**:
   - Express extracts `payload.email` and queries MongoDB: `const user = await usersCollection.findOne({ email: payload.email })`.
   - If user is missing or role updated by admin, Express assigns the live DB user data to `req.user = { id: user._id, email: user.email, role: user.role, name: user.name }`.
6. **Role Middlewares**:
   - `verifyCustomer`: checks `req.user.role === 'customer'`.
   - `verifyTechnician`: checks `req.user.role === 'technician'`.
   - `verifyAdmin`: checks `req.user.role === 'admin'`.

## 8 Stripe Flow
1. **Pre-condition**: Booking status is `completed` and `paymentStatus` is `unpaid`.
2. **Session Creation**:
   - Customer clicks "Pay Now" on `/dashboard/customer/bookings`.
   - Client sends `POST /api/payments/create-checkout-session` with `bookingId`.
   - Express validates booking exists, belongs to `req.user.email`, has `status === 'completed'` and `paymentStatus === 'unpaid'`.
   - Express reads `booking.finalAmount` from DB and sets `unit_amount: Math.round(booking.finalAmount * 100)`.
   - Session metadata includes `{ bookingId: booking._id.toString(), customerEmail: req.user.email }`.
   - Express returns `{ url: session.url }`; frontend redirects user.
3. **Shared Idempotent Fulfillment Function (`fulfillPayment(session)`)**:
   - Extracts `bookingId`, `customerEmail`, `stripeSessionId = session.id`, `transactionId = session.payment_intent`, `amount = session.amount_total / 100`.
   - Checks if `paymentsCollection.findOne({ stripeSessionId })` exists. If exists, returns successfully without rewriting.
   - Atomically inserts document into `payments` collection and updates `bookingsCollection.updateOne({ _id: new ObjectId(bookingId) }, { $set: { paymentStatus: 'paid' } })`.
4. **Execution Channels**:
   - **Verify Endpoint (`GET /api/payments/verify?session_id=...`)**: Called by `/payment/success` page; retrieves session via Stripe SDK and calls `fulfillPayment(session)`.
   - **Stripe Webhook (`POST /api/webhook/stripe`)**: Receives `checkout.session.completed` event, verifies Stripe signature with raw body, and calls `fulfillPayment(session)`.

## 9 Conflicts Between the Resources and the Brief (The Brief Wins)
1. **Application Roles**:
   - *Resource Auth*: Uses educational sample roles (`student`, `mentor`, `admin`).
   - *Brief*: FixMate requires repair platform roles: `customer`, `technician`, `admin`. **Brief Wins.**
2. **Additional Fields in User Model**:
   - *Resource Auth*: Shows only `role` in BetterAuth additionalFields.
   - *Brief*: Users require `role`, `phone`, `area`, and `bio` stored in BetterAuth `user` collection. **Brief Wins.**
3. **User Record & Role Authority**:
   - *Resource Auth*: Relies primarily on payload or inserts default student.
   - *Brief*: Express must verify via JWKS, query MongoDB by email to fetch the authoritative database role, and prevent privilege desync when an admin changes a user's role. **Brief Wins.**
4. **Stripe Checkout Session Initiation & Pricing**:
   - *Resource Stripe*: Uses Next.js route handlers (`/api/checkout_sessions`) with frontend-sent `totalTicketPrice`.
   - *Brief*: Express backend must host `POST /api/payments/create-checkout-session`, load the booking from MongoDB, and enforce `finalAmount * 100` (never trust client amounts). **Brief Wins.**
5. **Payment Model Schema**:
   - *Resource Stripe*: Defines `eventId`, `userEmail`, `quantity`, `amountPaid`.
   - *Brief*: Payments collection must strictly store: `bookingId`, `serviceTitle`, `customerName`, `customerEmail`, `technicianName`, `technicianEmail`, `amount`, `currency: 'usd'`, `transactionId`, `stripeSessionId` (unique), `paymentStatus: 'paid'`, `paidAt`. **Brief Wins.**
6. **Express Route Ordering**:
   - *Standard Routing*: Parameterized routes like `/:id` can shadow static child endpoints.
   - *Brief*: Challenge 2 mandates declaring `GET /api/services/my` strictly before `GET /api/services/:id`. **Brief Wins.**
