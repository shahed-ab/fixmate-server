# FixMate Steps (frontend first, mock data)

ORDER
Phase 1, client only, mock data: C1, C2, C3, C4, C5, C6, C7, C8, C9, C10, C11, C12, C13, C14, C15
Phase 2, server: S1, A1, S2, S3, S4, S5, S6, S7, SEED
Phase 3, connect client to real API: I1, I2, I3, I4, I5, I6, I7, DEPLOY, README

RULES FOR EVERY STEP
- Follow .agent/rules/fixmate.md. Read only the PLAN.md sections a step names. Open mockups only if named.
- Every client page needs: loading skeleton, empty state, error toast, responsive layout.
- Reuse StatusBadge, PaymentBadge, Button, Container, Logo, StatsCard. Never restyle them per page.
- Finish with the commit list (message + exact files, 3 to 6 small commits) and STOP. Client repo needs 20+ commits and server repo 12+, so keep commits small and logical.

ENDPOINT NAMES (used in Phase 2 and 3)
Webhook POST /api/webhook/stripe. Stats GET /api/customer/stats, /api/technician/stats, /api/admin/stats, public GET /api/stats. Availability toggle PATCH /api/services/:id/availability (separate, must NOT reset approval).

MOCK DATA CONTRACT (Phase 1)
- Pages and components NEVER read mock arrays directly. They only call async functions in client/lib/data.ts.
- Mock records use the EXACT field names and status values from the brief (approvalStatus, isAvailable, finalAmount, paymentStatus, technicianEmail, customerEmail, status requested|accepted|rejected|in-progress|completed|cancelled, and so on).
- Later (Phase 3) only the inside of data.ts functions changes to real fetch calls. Pages stay the same.

---

## C1
Client scaffold in /client (create if missing; keep the git repo create-next-app makes). Read PLAN.md section 6.
- Next.js App Router, TypeScript, Tailwind, ESLint, no src dir. Add shadcn/ui, sonner, react-hook-form, zod, @hookform/resolvers, lucide-react, recharts.
- Theme tokens as CSS variables + Tailwind theme (teal/green primary, off-white background) from @design/FixMate - Home Page.png (colors only). Fonts via next/font.
- Create: <Toaster/> in root layout; components/Logo (wrench icon + FixMate, one size everywhere); StatusBadge (requested=blue, accepted=indigo, in-progress=amber, completed=green, rejected=red, cancelled=gray); PaymentBadge (unpaid/paid); shared Button style; Container.
- .env.example: NEXT_PUBLIC_API_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, MONGODB_URI, DB_NAME, IMGBB_API_KEY. Ensure .env.local is git-ignored.

## C2
Mock data layer. Read PLAN.md section 3 (schemas) only.
- lib/types.ts: User, Service, Booking, Payment exactly as in the schemas.
- lib/mock-data.ts: 3 technicians, 3 customers, 1 admin; 14 approved services across all 7 categories (real-looking titles, prices, areas; images from the files in @design/ or placeholder URLs); a few pending/rejected services; bookings in every status; 2 payments for paid bookings.
- lib/data.ts: async functions (getFeaturedServices, getServices(params: q, category, mode, sort, page, limit) returning {items,total,page,pages}, getServiceById, getMyBookings, createBooking with the duplicate-active and own-service checks, cancelBooking, getTechnicianServices, createService, updateService (sets approvalStatus pending), deleteService, toggleAvailability, getTechnicianBookings, updateBookingStatus using the status pipeline map from the rules, getAdminUsers, changeUserRole, getAdminServices, setApproval, getAdminBookings, getPayments, getStats(role)). Mutations change in-memory state persisted in localStorage so a refresh keeps them. Add a small artificial delay (300ms) to show loading states.
- Mock session: lib/mock-session.tsx with a provider and a small floating dev role switcher (customer / technician / admin / logged out). Comment clearly: "MOCK, replaced by Better Auth in Phase 3".

## C3
Layout, navbar, footer, special pages. Mockups: @design/FixMate - Home Page.png (nav and footer only), @design/FixMate - 404 Not Found.png, @design/FixMate - Something Went Wrong.png.
- Public layout. Sticky Navbar: Home, Services, About only (no Pricing link); active route highlight; hamburger on mobile; logged out: Sign In and Sign Up; logged in: avatar dropdown with name, role badge, Dashboard link by role, Update Profile, Sign Out (toast). Use the mock session.
- Footer: logo, tagline, quick links, popular categories, contact, X logo (not the bird), social, copyright.
- app/not-found.tsx (tools themed, Back to Home), app/error.tsx, app/loading.tsx.

## C4
Home page. Mockup: @design/FixMate - Home Page.png.
- Hero with CTA/search to /services; Featured 6 latest via getFeaturedServices (reusable ServiceCard: equal height, image, title, category, mode, price, technician, View Details; hide star ratings); How It Works (4 steps); Popular Categories linking to /services?category=...; Why Choose Us with trust stats.

## C5
Browse Services. Mockup: @design/FixMate - Browse Services.png.
- /services server component reading searchParams (q, category, mode, sort, page) and calling getServices(params). Client filter bar updates the URL (debounced search) so filters survive reload and /services?category=AC works. Grid 1/2/3-4 columns, equal cards, empty state, Previous/Next + page numbers. Filtering/sorting lives ONLY inside getServices, never in components.

## C6
Service Details and request form. Mockup: @design/FixMate - Service Details.png.
- /services/[id]; notFound() if getServiceById returns nothing or the service is not approved/available. Technician summary (name, photo, area, bio).
- Request Repair: logged out goes to /sign-in?callbackUrl; technician/admin disabled with notice "Only customers can request a repair"; customer opens modal (name/email read-only, phone, address, preferred date today or later, description min 20 chars). On duplicate active request show toast "You already have an active request for this service". Success toast with link to My Bookings.

## C7
Sign in / Sign up pages (UI + validation, mock submit). Mockups: @design/FixMate - Create Account.png, @design/FixMate - Sign In.png.
- Sign-up: name, email, password (min 6, 1 uppercase, 1 lowercase, errors under field, no submit if invalid), role cards customer/technician only. Sign-in: email, password. react-hook-form + zod, toasts, links between pages. Mock submit sets the mock session and redirects to callbackUrl or /dashboard/<role>. Logged-in users are redirected to their dashboard.

## C8
Dashboard layout. Read PLAN.md section 5 (dashboard part) only.
- Dashboard layout: collapsible sidebar (toggle on mobile/tablet), top bar with avatar, name, role, Home link, no public footer. Sidebar items by role. Client-side guard using the mock session: logged out goes to /sign-in, wrong role goes to own dashboard.
- Reusable StatsCard, a DataTable that turns into cards on mobile, and a reusable ConfirmModal.

## C9
Customer dashboard. Mockups: @design/FixMate - Customer Dashboard.png, @design/FixMate - My Bookings.png, @design/FixMate - Payment History.png.
- Overview: 3 stats cards + a recharts chart from getStats('customer').
- /dashboard/customer/bookings: table/cards with status + payment badges; Cancel only when requested (ConfirmModal); Pay Now only when completed + unpaid (mock: toast and mark paid, comment "replaced by Stripe in Phase 3"); paid shows Paid badge.
- /dashboard/customer/payments: payment history table.

## C10
Technician services. Mockups: @design/FixMate - Technician Dashboard.png, @design/FixMate - Add Service.png, @design/FixMate - Technician My Services.png.
- Overview with stats + chart.
- Add Service form: validated; category dropdown; mode; name/email read-only; image via reusable lib/uploadImage.ts using ImgBB per @docs/resource-imgbb.md (file input, type/size check, preview, uploading state, image required). Toast says it is waiting for admin approval.
- My Services table: edit modal (pre-filled, tells it returns to pending), delete with confirm, availability switch, approval badge.

## C11
Technician requests. Mockup: @design/FixMate - Technician Manage Requests.png.
- Table with status filter (All, Requested, Accepted, In Progress, Completed). Only valid actions per status: requested Accept/Reject (reject needs ConfirmModal); accepted Start Work; in-progress Mark Completed (modal, finalAmount pre-filled with basePrice, must be > 0). Completed shows payment badge. Uses updateBookingStatus, which enforces the pipeline.

## C12
Admin dashboard. Mockups: @design/FixMate - Admin Dashboard.png, @design/FixMate - Admin Manage Users.png, @design/FixMate - Service Approvals.png, @design/FixMate - Admin All Bookings.png, @design/FixMate - Admin Transactions.png.
- Overview stats + charts. Users table with role select (disabled on own row). Service approval (pending first, status filter, approve/reject). Read-only bookings with status filter. Transactions with total revenue above the table.

## C13
Update profile + payment pages. Mockups: @design/FixMate - Update Profile.png, @design/FixMate - Payment Successful.png, @design/FixMate - Payment Cancelled.png.
- /dashboard/profile: name, phone, area, bio, photo via uploadImage; email and role read-only; after save the navbar and top bar update immediately.
- /payment/success (amount and transaction id from mock, button to My Bookings) and /payment/cancel (Try Again to My Bookings).

## C14
How It Works / About page. Mockup: @design/FixMate - How It Works.png. Static page: mission, step-by-step guide, FAQ accordion, CTA.

## C15
Polish only. Fix: consistent headings, buttons, spacing; equal card sizes; loading.tsx for services and dashboard; empty states everywhere; mobile tables and sidebar; active route highlight; keyboard focus. List changes in 6 bullets. Do not add features.

---

## S1
Server skeleton in /server. Read PLAN.md sections 3 and 4 only.
- ESM Express app. package.json (type module; dev = node --watch src/index.js; start = node src/index.js). Deps: express, cors, dotenv, mongodb, jose, stripe.
- src/index.js: dotenv, cors, GET / (status), GET /api/health (ok + time), then 404 and error handlers. Marked placeholder comment ABOVE express.json() for the Stripe webhook raw-body route.
- src/db.js: cached MongoClient (serverless safe), getCollections() returning users (the "user" collection used by BetterAuth), services, bookings, payments; createIndexes(): payments.stripeSessionId unique, services (approvalStatus, isAvailable, createdAt), bookings (customerEmail, technicianEmail, serviceId).
- src/config/cors.js: origins from CLIENT_URL (comma-separated), credentials true.
- src/middlewares/errorHandlers.js: JSON 404 and JSON error handler, no stack traces.
- vercel.json routing all to the app; export app as default; app.listen only when process.env.VERCEL is unset.
- .gitignore (node_modules, .env), .env.example: PORT, MONGODB_URI, DB_NAME, CLIENT_URL, JWKS_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
- No routes beyond / and /api/health.

## A1
Better Auth in /client (the only client work in Phase 2). Read PLAN.md section 7 and @docs/resource-auth.md.
- lib/mongodb.ts, lib/auth.ts: mongodbAdapter, emailAndPassword, jwt() plugin, trustedOrigins from env, additionalFields role (default "customer", input true), phone, area, bio (optional strings), cookieCache enabled.
- databaseHooks.user.create.before: role must be "customer" or "technician", else "customer".
- app/api/auth/[...all]/route.ts, lib/auth-client.ts with jwtClient() and inferAdditionalFields().
- Helper getAuthToken() returning a JWT usable by Express. Check the INSTALLED better-auth docs/types for the right method; session.token may not be the JWT. Tell me which method you used.
- Do NOT touch pages or mock data.

## S2
JWT and role middlewares in /server. Read @docs/resource-auth.md.
- src/middlewares/auth.js: verifyToken (Bearer token, jwtVerify with createRemoteJWKSet(JWKS_URL), find user in the "user" collection by email, 401 if missing, do NOT insert, req.user = {id,email,role,name} using the DB role). verifyCustomer, verifyTechnician, verifyAdmin return 403.
- Temporary routes GET /api/me (verifyToken) and GET /api/test/admin (verifyToken, verifyAdmin), marked for removal.

## S3
Services API in /server. Read PLAN.md section 4.
- Public GET /api/services: approved + isAvailable only. Query q (regex-escaped, title or category), category, mode, sort (price-asc, price-desc, newest), page, limit. Return {items,total,page,pages}. All in MongoDB.
- GET /api/services/home (latest 6). GET /api/services/my (token + technician), declared BEFORE /:id. GET /api/services/:id (public; 404 for invalid ObjectId or not approved/available; include technician summary from users).
- Technician (token + technician, owner only): POST /api/services (pending, isAvailable true, createdAt, technician name/email from req.user), PATCH /:id (resets to pending), DELETE /:id, PATCH /:id/availability (does not reset approval).
- Validate: basePrice > 0, category and serviceMode enums, required fields.

## S4
Admin and profile APIs in /server.
- Admin (token + admin): GET /api/admin/users, PATCH /api/admin/users/:id/role (valid roles only, cannot change own role), GET /api/admin/services?status=, PATCH /api/admin/services/:id/approval (approved or rejected), GET /api/admin/bookings?status=, GET /api/admin/payments (include totalRevenue).
- PATCH /api/users/profile (token): name, phone, area, bio, image only. Never role or email.

## S5
Bookings and status pipeline in /server. Follow the JOB STATUS PIPELINE in the rules and PLAN.md section 4.
- POST /api/bookings (token + customer): service approved and available; block own service; block duplicate active (requested, accepted, in-progress) for same customer + service with 409 "You already have an active request for this service"; validate phone, address, preferredDate (today or later), problemDescription (>= 20); copy service and technician fields; finalAmount = basePrice; status requested; paymentStatus unpaid.
- GET /api/bookings/my (customer, own only). PATCH /api/bookings/:id/cancel (owner customer, only while requested).
- GET /api/bookings/technician?status= (own only). PATCH /api/bookings/:id/status (owner technician): transition map + atomic updateOne filtered by _id and current status.

## S6
Stripe in /server. Read PLAN.md section 8 and @docs/resource-stripe.md. The brief overrides the resource.
- POST /api/payments/create-checkout-session (token + customer): load booking from DB, must belong to req.user.email, status completed, paymentStatus unpaid; unit_amount = Math.round(finalAmount*100); metadata {bookingId, customerEmail}; success_url CLIENT_URL/payment/success?session_id={CHECKOUT_SESSION_ID}; cancel_url CLIENT_URL/payment/cancel.
- GET /api/payments/verify?session_id= (token + customer): retrieve session; metadata.customerEmail must equal req.user.email; then fulfillPayment.
- POST /api/webhook/stripe: express.raw, registered BEFORE express.json, constructEvent, handle checkout.session.completed with the SAME fulfillPayment.
- fulfillPayment: only if status complete and payment_status paid; insert into payments (ignore duplicate key 11000); updateOne booking filtered by paymentStatus unpaid.
- GET /api/payments/my (customer).

## S7
Stats in /server. MongoDB aggregations, small payloads.
- GET /api/customer/stats (total, active, completed, spending by month). GET /api/technician/stats (total services, approved, pending requests, jobs by status, earnings by month). GET /api/admin/stats (total users, technicians, pending services, revenue by month, bookings by status). Each with its role middleware.
- Public GET /api/stats (verified technicians, completed jobs).

## SEED
Seed script at client/scripts/seed.ts (run with tsx, reads env).
- Create users THROUGH auth.api.signUpEmail (1 admin, 3 technicians, 3 customers), then set the admin role directly in Mongo.
- Insert 14 approved services across all 7 categories (reuse the mock data), bookings in every status, payments for paid ones. Idempotent (skip if exists).
- Add npm script "seed".

---

## I1
Connect public pages to the real API. Edit only lib/data.ts and the auth bits it needs.
- getFeaturedServices, getServices, getServiceById call the server (GET /api/services/home, /api/services, /api/services/:id) with NEXT_PUBLIC_API_URL. Keep identical return shapes. Remove the mock for these functions.

## I2
Connect real sign-up and sign-in (replace the mock session).
- /sign-up and /sign-in use authClient (signUp.email with role, signIn.email). Server-side redirect of logged-in users with auth.api.getSession. Navbar, dashboard top bar and request form read the real session. Remove the floating mock role switcher.

## I3
Connect customer features: createBooking, getMyBookings, cancelBooking, getPayments, customer stats. Calls send Authorization: Bearer <getAuthToken()>. Map server errors to toasts (409 duplicate message).

## I4
Connect Stripe flow. Pay Now calls POST /api/payments/create-checkout-session and redirects to the returned URL. /payment/success calls GET /api/payments/verify once and shows amount + transaction id. /payment/cancel unchanged.

## I5
Connect technician features: services CRUD, availability, requests, status updates, technician stats.

## I6
Connect admin features and profile: users, role change, service approval, bookings, transactions, admin stats, PATCH /api/users/profile. After profile save, refresh the Better Auth session bypassing cookie cache so navbar and top bar update.

## I7
Real route protection and cleanup. Server-side guards in the dashboard layout with auth.api.getSession (logged out to /sign-in?callbackUrl; wrong role to own dashboard). Hard reload must not log out. Remove all remaining mock files and the temporary /api/me and /api/test/admin routes in the server.

## DEPLOY
List exactly the env vars needed on Vercel for each project and where to add production domains (server CLIENT_URL and JWKS_URL; client BETTER_AUTH_URL and trustedOrigins; Stripe webhook URL https://<server>/api/webhook/stripe). Check `npm run build` passes in client and vercel.json is valid in server. Change code only if broken.

## README
README.md in both repos: name, purpose, live URL placeholder, admin/technician/customer credential placeholders, key features, npm packages, setup steps.