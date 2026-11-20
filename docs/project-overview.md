Project Overview and Discussion
Project Theme: On-demand Device & Home Appliance Repair Service Booking Platform.
What is the Project: FixMate is a full-stack, role-based repair service platform built with Next.js, Express, MongoDB, BetterAuth, JWT, and Stripe. Verified Technicians list the repair services they offer (smartphone screen replacement, laptop servicing, AC servicing, refrigerator, TV, washing machine, electrical wiring, etc.). Customers browse those services, send a repair request with a problem description, track the job step by step, and pay online only after the job is completed. Admins approve service listings, manage users, monitor all repair jobs, and track Stripe revenue.
Why We Should Develop the Project: In Bangladesh and worldwide, people struggle to find a trustworthy repair technician. After handing over a device, they have no idea what is happening with the job and often pay before any work is done. On the other side, skilled technicians have no structured place to show their services and manage incoming jobs. FixMate solves both problems: every job has a clear, trackable status, and payment happens only after the work is delivered.
How the System Works:
A user registers as a Customer or a Technician.
A Technician adds a repair service (with an image uploaded through ImgBB). The service stays pending until an Admin approves it.
Customers browse approved services, search/filter/sort them, open the details page, and send a Repair Request (phone, address, preferred date, problem description).
The Technician moves the job through a status pipeline: Requested → Accepted → In Progress → Completed (or Rejected). When completing, the Technician sets the final amount.
Once the job is Completed, a Pay Now button appears for the Customer. The Customer pays with Stripe, the payment is saved, and the job is marked Paid.
The Admin approves/rejects services, manages user roles, monitors all repair jobs, and sees every transaction.
Stakeholders (3):
Role
What they do
Customer
Browses services, sends repair requests, cancels a request while it is still "requested", pays for completed jobs, sees payment history
Technician
Adds and manages repair services, accepts/rejects requests, updates job status, sets the final amount
Admin
Approves/rejects services, manages users and roles, monitors all bookings and transactions


Similar Websites / Design Inspiration Links:
Sheba.xyz (local home services, Bangladesh): https://www.sheba.xyz/
Urban Company (service cards & booking flow): https://www.urbancompany.com/
TaskRabbit (provider listing & request flow): https://www.taskrabbit.com/
Thumbtack (service search & categories): https://www.thumbtack.com/
ThemeForest repair/handyman templates: https://themeforest.net/search/repair%20service
Note: Use these only for design ideas. Do not copy any website. Your design must be your own.


Ensure the Following Things to Get 100% Mark (No Mark Will Contain)
Include at least 20 meaningful commits on the client side & 12 meaningful commits on the server side with descriptive messages.
Include a README.md file with the project name, purpose, live URL, admin credentials, key features, and any npm packages you have used.
Secure frontend configuration keys using environment variables (.env.local).
Secure your MongoDB, BetterAuth, JWT, ImgBB, and Stripe credentials using environment variables (.env).
Create a design that encourages recruiters. Color contrast should please the eye & ensure that the website has proper alignment, space, and the website does not express gobindo design.
If we find your project similar to any project of your module / conceptual / assignment, you will get 0 and may miss the chance of any upcoming reward.
Deployment Guideline
If your deployment is not okay, you will get 0 and may miss the chance of our upcoming rewards.
Ensure that your server is working perfectly on production and not throwing any CORS / 404 / 504 errors.
Ensure that your live link is working perfectly and that it is not showing errors on landing in your system.
⚠️ Ensure that the page doesn't throw any error on reloading from any route.
⚠️ A logged-in user must not be redirected to Login on reloading any private route.
Add your production domain to the BetterAuth trusted origins and to the server's CORS allowed origins.
Add the Stripe webhook endpoint of your deployed server in the Stripe Dashboard (test mode) and put its signing secret in your server .env.
Logical Data Design & Database Architecture (4 Collections)
Before writing any code, read this design carefully. FixMate has 3 stakeholders (Customer, Technician, Admin) and uses exactly 4 MongoDB collections for its own data: users, services, bookings, payments.
Note on BetterAuth: BetterAuth's MongoDB adapter stores users in its own user collection and also creates session, account and verification collections automatically. Treat BetterAuth's user collection as our users collection, and add the extra fields (role, phone, area, bio) using BetterAuth additionalFields. The auto-created auth collections are not counted in the 4.


Collection Overview
Collection
Created / Updated By
Primary Purpose
1. users
BetterAuth (Sign Up) / Update Profile / Admin
Stores every user, their role and profile information
2. services
Created & managed by Technician; approved/rejected by Admin
Stores the repair services a technician offers
3. bookings
Created by Customer; status updated by Technician; payment status updated by Stripe
Stores every repair request (job) and its current status
4. payments
Created by Stripe Checkout verification / Webhook
Stores the payment record of each paid job


1. users
Field
Type
Description
_id
ObjectId
Auto generated
name
String
Full name
email
String
Unique email (used to link data across collections)
image
String
Profile photo URL (ImgBB)
role
String
'customer' | 'technician' | 'admin' (default 'customer')
phone
String
Contact number
area
String
City / area, e.g. "Mirpur, Dhaka"
bio
String
Short bio (useful for technicians: skills & experience)


2. services
Field
Type
Description
_id
ObjectId
Auto generated
title
String
e.g. "iPhone Screen Replacement"
category
String
'Smartphone' | 'Laptop & PC' | 'AC' | 'Refrigerator' | 'TV' | 'Washing Machine' | 'Electrical'
description
String
What the service includes
image
String
Service banner URL (ImgBB)
basePrice
Number
Starting price in USD (shown on cards)
estimatedDuration
String
e.g. "2-3 hours", "1 day"
serviceMode
String
'Home Visit' | 'Shop Drop-off'
serviceArea
String
Area the technician covers, e.g. "Dhanmondi, Dhaka"
technicianName
String
Copied from the logged-in technician
technicianEmail
String
Copied from the logged-in technician (owner of the service)
approvalStatus
String
'pending' | 'approved' | 'rejected' (default 'pending')
isAvailable
Boolean
Technician can turn the service on/off (default true)
createdAt
Date
Creation time


3. bookings
Field
Type
Description
_id
ObjectId
Auto generated
serviceId
String
_id of the booked service
serviceTitle, serviceImage, category
String
Copied from the service (so the booking still shows correctly if the service is edited or deleted later)
basePrice
Number
Copied from the service at request time
technicianName, technicianEmail
String
Copied from the service
customerName, customerEmail
String
From the logged-in customer
customerPhone
String
From the request form
address
String
Service address / pickup address
preferredDate
Date
Date the customer wants the service
problemDescription
String
What is wrong with the device
status
String
'requested' | 'accepted' | 'rejected' | 'in-progress' | 'completed' | 'cancelled' (default 'requested')
finalAmount
Number
Set by the technician when marking the job 'completed' (default = basePrice)
paymentStatus
String
'unpaid' | 'paid' (default 'unpaid')


4. payments
Field
Type
Description
_id
ObjectId
Auto generated
bookingId
String
_id of the paid booking
serviceTitle
String
Copied from the booking
customerName, customerEmail
String
Who paid
technicianName, technicianEmail
String
Who earned it
amount
Number
Paid amount (= booking finalAmount)
currency
String
'usd'
transactionId
String
Stripe payment_intent id
stripeSessionId
String
Stripe Checkout Session id (must be unique)
paymentStatus
String
'paid'
paidAt
Date
Payment time


How the 4 Collections Connect
users → services: one technician has many services, linked by services.technicianEmail = users.email.
services → bookings: one service has many bookings, linked by bookings.serviceId = services._id.
users → bookings: one customer has many bookings (bookings.customerEmail); one technician receives many bookings (bookings.technicianEmail).
bookings → payments: one completed booking has at most one payment, linked by payments.bookingId = bookings._id.
Logical Workflow (Step by Step)
Step 1 (Role Registration): A user signs up through BetterAuth and chooses the role 'customer' or 'technician'. The account is saved to users. Nobody can sign up as 'admin'; the admin account is created manually (seed or database).
Step 2 (Adding a Service): A technician adds a service from the dashboard. It is saved in services with approvalStatus: 'pending' and isAvailable: true.
Step 3 (Admin Moderation): The admin approves or rejects the service. Only services with approvalStatus: 'approved' and isAvailable: true appear on public pages. If a technician edits a service later, its approvalStatus goes back to 'pending'.
Step 4 (Repair Request): A customer opens an approved service and submits the request form. A document is created in bookings with status: 'requested' and paymentStatus: 'unpaid'.
Step 5 (Job Status Pipeline): The technician updates the job: requested → accepted or rejected, then accepted → in-progress, then in-progress → completed (setting finalAmount). The customer can cancel only while the job is still 'requested'.
Step 6 (Payment): When a booking is 'completed' and 'unpaid', the customer pays through Stripe Checkout. A document is inserted into payments, and the booking is updated to paymentStatus: 'paid'.
Job Status Rules (Who Can Change What)

Figure: FixMate job status pipeline
Only a Requested job can branch off (rejected by the technician or cancelled by the customer); every other step moves one stage forward.
Current status
Next status
Who can change it
Extra rule
requested
accepted
Technician (owner of the job)
—
requested
rejected
Technician (owner of the job)
Final state
requested
cancelled
Customer (owner of the booking)
Final state
accepted
in-progress
Technician (owner of the job)
—
in-progress
completed
Technician (owner of the job)
Must send finalAmount (number greater than 0)
completed + unpaid
paid (paymentStatus)
Stripe (after customer pays)
Only once per booking


Any other change (for example requested → completed, or changing a cancelled job) is not allowed. Your server must reject it (see Challenge 3).
Important Business Rules
A customer cannot have two active requests (requested, accepted or in-progress) for the same service at the same time.
A technician cannot request their own service. Technicians and admins cannot send repair requests at all.
A technician can only see and update bookings where technicianEmail matches their own email. A customer can only see their own bookings.
The Pay Now button appears only when status === 'completed' and paymentStatus === 'unpaid'.

Main Part (50 Marks)


The main part covers everything from Layout & Page Structure to the UI Design Requirements below.
Layout & Page Structure
1. Requirement for Navbar
Logo & Brand Name: FixMate logo with a tool/wrench icon. Keep the logo the same style and size on every page.
Public Navigation Items: Home (/), Services (/services), How It Works / About (/about).
Navbar State for Logged-out Users: Show Sign In and Sign Up buttons.
Navbar State for Logged-in Users: Show the user's profile image (avatar). Clicking it opens a dropdown with the user's name, a role badge (Customer / Technician / Admin), a Dashboard link (goes to the correct dashboard for the role), Update Profile, and Sign Out.
Make the navbar sticky and highlight the active route.
On mobile, the navbar must collapse into a hamburger menu.
2. Requirement for Footer
FixMate logo, a short tagline, quick links (Home, Services, About), popular categories, contact info (email, phone, address), copyright text, and social links. Use the new X logo instead of the old Twitter bird.
3. Main Layout & All Pages
Public layout (Navbar + page + Footer) is used on public pages. Dashboard pages use a separate Dashboard Layout (sidebar + top bar, no public footer).
Page
Route
Access
Home
/
Public
Browse Services
/services
Public
Service Details
/services/[id]
Public (the request form works for logged-in customers only)
How It Works / About
/about
Public
Sign Up / Sign In
/sign-up, /sign-in
Public (logged-in users are redirected to their dashboard)
Payment Success / Cancel
/payment/success, /payment/cancel
Customer
Customer Dashboard
/dashboard/customer, /dashboard/customer/bookings, /dashboard/customer/payments
Customer
Technician Dashboard
/dashboard/technician, /dashboard/technician/add-service, /dashboard/technician/my-services, /dashboard/technician/requests
Technician
Admin Dashboard
/dashboard/admin, /dashboard/admin/users, /dashboard/admin/services, /dashboard/admin/bookings, /dashboard/admin/transactions
Admin
Update Profile
/dashboard/profile
All logged-in users
Not Found
any unknown route
Public


Protect every dashboard route. A logged-out user must be redirected to /sign-in. A logged-in user who opens another role's route (e.g. a customer opening /dashboard/admin) must be redirected to their own dashboard or shown a "Forbidden" message.
Authentication System
BetterAuth & Database Connection
Set up BetterAuth with the MongoDB adapter and connect it to your Next.js app.
Add role, phone, area and bio as BetterAuth additional fields on the user. role defaults to 'customer'. phone, area, bio can add while updating the profile. 
Sign Up Page (/sign-up)
Show a title and a form with: Full Name, Email, Password, and Role Selection (Customer / Technician as radio buttons or cards).
Admin must not be selectable. Validate on the server too: if anything other than 'customer' or 'technician' is sent, save 'customer'.
Password validation (show the errors under the field and do not submit an invalid password):
at least 6 characters
at least one uppercase letter
at least one lowercase letter
Validate required fields and email format.
On success, show a success toast and redirect the user to their role's dashboard (or to Sign In). On failure (e.g. email already exists), show an error toast.
Add a link to the Sign In page.
Sign In Page (/sign-in)
Email & Password login with validation and error toasts for wrong credentials.
After login, redirect the user to the page they were trying to open; otherwise, to their own dashboard (/dashboard/customer, /dashboard/technician or /dashboard/admin).
Add a link to the Sign Up page.
Optional: Google Social Login with BetterAuth (a Google user gets the 'customer' role by default).
Home Page Requirements
Hero / Banner Section: A modern banner with a clear headline (e.g. "Broken Device? Get It Fixed by Verified Technicians"), a short subtitle, a search box or CTA button that leads to /services, and a high-quality illustration or photo. A slider is optional.
Dynamic Featured Services Section: Fetch and show the 6 latest services where approvalStatus: 'approved' and isAvailable: true (use .sort({ createdAt: -1 }).limit(6)). Each card must be equal in height and width and show: image, title, category, service mode, starting price, technician name, and a View Details button.
Extra Section 1: How FixMate Works: A 4-step visual flow: Find a Service → Send a Request → Technician Fixes It → Pay After Completion.
Extra Section 2: Popular Categories & Why Choose Us: Show the repair categories (Smartphone, Laptop & PC, AC, Refrigerator, TV, Washing Machine, Electrical) as clickable cards that open selected category cards together with trust points or platform stats (verified technicians, jobs completed, pay after service) or customer testimonials.
Sections 3 and 4 can use static data, but they must match the FixMate theme and look professional.


Browse Services, Service Details & Repair Request
Browse Services Page (/services)
Fetch and show all services where approvalStatus === 'approved' and isAvailable === true in a responsive grid (3-4 cards per row on desktop, 2 on tablet, 1 on mobile).
Each card shows: image, title, category, service mode (Home Visit / Shop Drop-off), service area, starting price, technician name, and a View Details button.
Show a friendly empty state when no service matches.
The search bar, filters and sort on this page are part of Challenge 1.
Service Details Page (/services/[id])
Show full information: large image, title, category, description, starting price, estimated duration, service mode, service area, and a technician summary (name, photo, area, bio).
If the service does not exist or is not approved/available, show the Not Found page.
Role-Restricted Repair Request Flow
Show a Request Repair button on the details page.
Logged-out user: clicking it redirects to /sign-in (and back to this page after login).
Technician or Admin: the button is disabled or hidden, with a notice like "Only customers can request a repair".
Customer: clicking it opens a request form (modal or section).
The request form has: Name (read-only, from session), Email (read-only, from session), Phone, Address, Preferred Date (today or a future date only), and Problem Description (minimum 20 characters).
On submit, save a document in the bookings collection with status: 'requested', paymentStatus: 'unpaid', and the copied service and technician information (see the data design).
Prevent duplicate active requests: if the same customer already has a requested, accepted or in-progress booking for this service, the server must refuse it and the client must show an error toast ("You already have an active request for this service").
Show a success toast and a link to My Bookings after a successful request.
Dashboard Layout
Build one responsive Dashboard Layout with a collapsible sidebar (toggle button on mobile/tablet), a top bar with the user's avatar, name and role, and a link back to Home. The sidebar menu must change dynamically based on the logged-in user's role. Every overview page uses reusable stats cards.
1. Customer Dashboard (Role: customer)
Route: /dashboard/customer (Overview)
Stats cards: Total Requests, Active Jobs, Completed Jobs.
Route: /dashboard/customer/bookings (My Bookings)
Table (or cards on mobile) of all bookings of the logged-in customer: service image & title, technician name, preferred date, base price / final amount, status badge (Requested / Accepted / In Progress / Completed / Rejected / Cancelled), and payment badge (Unpaid / Paid).
Cancel button only when status === 'requested'. Show a confirmation modal before cancelling, then set status: 'cancelled'.
Pay Now button only when status === 'completed' and paymentStatus === 'unpaid'. It starts the Stripe Checkout for that booking (see Stripe Payment).
A paid booking shows a Paid badge instead of the button.
Route: /dashboard/customer/payments (Payment History)
Table from the payments collection for this customer: service title, technician name, amount, transaction ID, payment date.
2. Technician Dashboard (Role: technician)
Route: /dashboard/technician (Overview)
Stats cards: Total Services, Approved Services, Pending Requests.
Route: /dashboard/technician/add-service (Add a Service)
Validated form: Title, Category (dropdown), Description, Base Price (positive number), Estimated Duration, Service Mode (Home Visit / Shop Drop-off), Service Area, and Service Image uploaded with ImgBB (file input, not a URL field).
Technician name and email are filled from the session (read-only).
Save with approvalStatus: 'pending' and isAvailable: true. Show a toast that says the service is waiting for admin approval.
Route: /dashboard/technician/my-services (My Services — Full CRUD)
Table of all services created by the logged-in technician with image, title, category, price, approval status badge (Pending / Approved / Rejected) and availability.
Update: edit the service in a pre-filled form (modal or page). After editing, set approvalStatus back to 'pending'.
Delete: delete with a confirmation modal.
Toggle availability: switch isAvailable on/off. An unavailable service disappears from public pages.
Route: /dashboard/technician/requests (Manage Requests)
Table of all bookings where technicianEmail is the logged-in technician: customer name, phone, address, preferred date, problem description, service title, status.
Show only the valid action buttons for each status:
requested → Accept / Reject
accepted → Start Work (becomes in-progress)
in-progress → Mark Completed: opens a small modal to enter the final amount (pre-filled with the base price)
completed, rejected, cancelled → no action (show the payment badge for completed jobs)
Add a filter by status (All / Requested / Accepted / In Progress / Completed).
3. Admin Dashboard (Role: admin)
Route: /dashboard/admin (Overview)
Stats cards: Total Users, Total Technicians, Pending Services
Route: /dashboard/admin/users (Manage Users)
Table of all users: photo, name, email, role, joined date.
Admin can change a user's role (customer / technician / admin) using the BetterAuth Admin plugin or a protected Express admin API. The admin cannot change their own role.
Route: /dashboard/admin/services (Service Approval)
Table of all services from all technicians with a filter by approval status.
Approve (approvalStatus: 'approved') or Reject (approvalStatus: 'rejected') any service. Pending services should be easy to find (shown first or filtered by default).
Route: /dashboard/admin/bookings (All Bookings)
Read-only table of every booking on the platform: service, customer, technician, date, status, payment status, amount. Add a filter by status.
Route: /dashboard/admin/transactions (Transactions)
Table of every document in the payments collection: customer, technician, service, amount, transaction ID, payment date. Show the total revenue above the table.
4. Shared Route: Update Profile (All Roles)
Route: /dashboard/profile
Every logged-in user can update Name, Phone, Area, Bio, and Profile Photo (file upload with the ImgBB API).
Email and role are shown as read-only.
After saving, the new name and photo must appear in the navbar and dashboard top bar without logging out.
Stripe Payment for Completed Jobs
FixMate uses a pay-after-service model: the customer pays per job, only after the technician marks the job completed. Use Stripe test mode only. The same payment must never be saved twice (webhook + success page, or Stripe retrying the webhook).
Payment flow:
The customer clicks Pay Now on a booking in My Bookings.
The client calls a protected server API, e.g. POST /api/payments/create-checkout-session with the bookingId.
The server loads the booking from the database (never trust an amount sent from the client), creates a Stripe Checkout Session with unit_amount = finalAmount × 100 (cents), success_url, cancel_url, and puts bookingId and customerEmail in the session metadata.
The client redirects the customer to the Stripe Checkout URL.
/payment/success?session_id=... page: call a protected server API (e.g. GET /api/payments/verify?session_id=...). The server retrieves the session from Stripe, and if payment_status === 'paid' it:
inserts a document into payments, and
updates the booking to paymentStatus: 'paid'.
Show a success message with the amount and transaction ID, and a button back to My Bookings.
/payment/cancel page: show a friendly "Payment cancelled" message with a Try Again button back to My Bookings. Nothing changes in the database.
Use test card 4242 4242 4242 4242 with any future date and any CVC. Saving the payment through the success-page verification is enough for the main part. Doing it with a Stripe Webhook is Challenge 4. If you do both, make sure the same payment is never saved twice.


Additional Requirements
Loading Page: Add a custom loading state / skeleton loader (loading.tsx or a spinner component) that shows while data is loading on public pages and dashboard routes.
Error Page: Add a custom 404 Not Found page (not-found.tsx) with a repair/tools-themed illustration and a Back to Home button, plus an error boundary page (error.tsx) with a clear message.
Toast Notifications: Use toasts (sonner / react-hot-toast) for sign up, sign in, sign out, every CRUD action, status updates, payments, and errors.
Empty States: Show friendly empty states with a CTA when there are no services, no bookings, no requests, or no search results.
Confirmation Modals: Ask for confirmation before deleting a service, cancelling a booking, or rejecting a request.
Seed Data: Your live site must look complete. Add realistic connected data: at least 2 technician accounts, 12+ approved services across different categories, and a few bookings in different statuses.
UI Design Requirements
Unique Design: First, decide what kind of website you want to make. Then, search online or check out websites like ThemeForest to get ideas for the design. But remember, your website idea shouldn't be similar to any projects you've done before or to any examples in our modules or conceptual sessions. You can also look for free resources on blogs to help with your website.
Keep the main heading style (font, size, color) consistent across all sections.
Keep paragraph spacing balanced and text easily readable.
Maintain uniform image sizes and spacing.
Use the same button style as on the home page.
Ensure good spacing and proper alignment.
Navbar: keep the heading/logo the same style and size as on the home page.
Use a grid layout with equal image sizes.
Keep all cards equal height and width (especially in the services section).
Use the new X logo instead of the old Twitter bird to match the latest rebrand.
Responsiveness: make it responsive for all devices, including mobile, tablet, and desktop views.
Dashboard UI Requirements
Responsive design for mobile and tablet screens
Consistent color theme
Full-width dashboard
Charts and graphs for quick data visualization
User profile section
Status badges with consistent colors across all dashboards (e.g. Requested = blue, Accepted = indigo, In Progress = amber, Completed = green, Rejected/Cancelled = red/gray)
Resources
https://uiverse.io/
https://devmeetsdevs.com/
https://bootcamp.uxdesign.cc/free-images-and-resources-collection-for-website-c77f2fc46ce5
https://themeforest.net/
https://codecanyon.net/

Challenge Part (10 Marks)


Complete all 4 challenges. Each one has its requirement and an implementation process to guide you.
Challenge 1: Server-Side Search, Filter & Sort on Browse Services
Requirement: On /services, add a search bar (by title or category), filters (category and service mode), and a sort dropdown (Price: Low to High, Price: High to Low, Newest). All searching, filtering and sorting must happen on the server (MongoDB), not with JavaScript .filter() on the client. Filters must stay after a page reload, and a category card on the Home page (/services?category=AC) must open the page already filtered.

Challenge 2: JWT Token Verification & Role-Based Middlewares
Requirement: Protect every private API with custom Express middlewares: verifyToken, verifyCustomer, verifyTechnician, and verifyAdmin. A request without a valid token gets 401 Unauthorized; a valid user with the wrong role gets 403 Forbidden. A user must also only reach their own data (a customer cannot read another customer's bookings by changing the email in the URL).
Apply them like this:
API
Middlewares
POST /api/bookings, PATCH /api/bookings/:id/cancel, GET /api/bookings/my, POST /api/payments/create-checkout-session
verifyToken, verifyCustomer
POST /api/services, PATCH /api/services/:id, DELETE /api/services/:id, GET /api/bookings/technician, PATCH /api/bookings/:id/status
verifyToken, verifyTechnician
GET /api/admin/users, PATCH /api/admin/users/:id/role, PATCH /api/admin/services/:id/approval, GET /api/admin/bookings, GET /api/admin/payments
verifyToken, verifyAdmin
PATCH /api/users/profile
verifyToken
GET /api/services, GET /api/services/:id
Public


Challenge 3: Server-Enforced Job Status Pipeline & Payment Gate
Requirement: Only the technician who owns a job can update job status. Payment must only be possible for a completed and unpaid booking owned by the logged-in customer.


Optional Requirements & Submission


Optional Requirements (Complete 2 to 5 to Differentiate Your Project)
These carry no marks, but they make your project stand out to recruiters.
Pro Technician Plan (Stripe Subscription): Free technicians can list up to 3 services; Pro technicians get unlimited services and a "Verified Pro" badge. Add a plan: 'free' | 'pro' field to users and record the subscription payment in payments.
Rating & Review: After a booking is paid, the customer can give a 1-5 star rating and a short review (store rating and review on the booking). Show the average rating on service cards and the details page.
Job Timeline Tracker: Store a statusHistory array ({ status, changedAt }) on each booking and show a visual step tracker (Requested → Accepted → In Progress → Completed → Paid) in My Bookings.
Server-Side Pagination: Add pagination (Previous / Next / page numbers) on Browse Services using MongoDB .skip() and .limit(), working together with search, filter and sort.
PDF Invoice & Dark Mode: Let customers download a PDF invoice for a paid job, and add a smooth dark/light theme toggle for the public pages and the dashboard.
Tech Stack
Area
Technology
Frontend
Next.js (App Router), HeroUI / DaisyUI / shadcn/ui, TypeScript / JavaScript
Authentication & Authorization
BetterAuth, MongoDB Adapter, JWT with Role-Based Authentication
Backend
Node.js, Express.js, MongoDB, TypeScript (if you are comfortable) / JavaScript
Payment & Media
Stripe (Checkout & Webhook, test mode), ImgBB API (image upload)


