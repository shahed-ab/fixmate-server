# Frontend vs backend, public vs private

## FRONTEND (Next.js): 22 pages

### Public pages (7)
Anyone can open these. Logged-out users can browse, but the request form on the details page works only for logged-in customers.

| # | Route | Page | Note |
|---|---|---|---|
| 1 | `/` | Home | Hero, featured services, how it works, categories |
| 2 | `/services` | Browse Services | Search, filter and sort |
| 3 | `/services/[id]` | Service Details | Request button depends on role |
| 4 | `/about` | How It Works / About | |
| 5 | `/sign-up` | Sign Up | **Guest-only**: logged-in users go to their dashboard |
| 6 | `/sign-in` | Sign In | **Guest-only**, same redirect |
| 7 | any unknown route | Not Found | `not-found.tsx` |

### Private pages (15)
A logged-out user is redirected to `/sign-in`. A wrong-role user is redirected to their own dashboard or sees "Forbidden".

**Customer only (5)**
| # | Route | Page |
|---|---|---|
| 8 | `/payment/success` | Payment Success |
| 9 | `/payment/cancel` | Payment Cancel |
| 10 | `/dashboard/customer` | Overview |
| 11 | `/dashboard/customer/bookings` | My Bookings |
| 12 | `/dashboard/customer/payments` | Payment History |

**Technician only (4)**
| # | Route | Page |
|---|---|---|
| 13 | `/dashboard/technician` | Overview |
| 14 | `/dashboard/technician/add-service` | Add Service |
| 15 | `/dashboard/technician/my-services` | My Services (CRUD) |
| 16 | `/dashboard/technician/requests` | Manage Requests |

**Admin only (5)**
| # | Route | Page |
|---|---|---|
| 17 | `/dashboard/admin` | Overview |
| 18 | `/dashboard/admin/users` | Manage Users |
| 19 | `/dashboard/admin/services` | Service Approval |
| 20 | `/dashboard/admin/bookings` | All Bookings |
| 21 | `/dashboard/admin/transactions` | Transactions |

**All logged-in roles (1)**
| # | Route | Page |
|---|---|---|
| 22 | `/dashboard/profile` | Update Profile |

### Frontend special files
- **Layouts:** Public (Navbar + Footer) and Dashboard (sidebar + top bar)
- **`loading.tsx`, `error.tsx`, `not-found.tsx`**
- **Modals:** request form, cancel booking, delete service, reject request, mark completed (final amount), edit service
- **BetterAuth route handler:** `/api/auth/[...all]`, which runs inside Next.js

---

## BACKEND (Express): no pages, only API endpoints

### Public (no token)
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/services` | List approved and available services, with server-side search, filter and sort |
| GET | `/api/services/:id` | Service details |
| POST | `/api/webhook/stripe` | Stripe webhook. It has no JWT, but it **must verify the Stripe signature** and use the raw body |

You may also want a public `GET /api/stats` for the home page trust numbers.

### Private: any logged-in user (`verifyToken`)
| Method | Endpoint | Purpose |
|---|---|---|
| PATCH | `/api/users/profile` | Update name, phone, area, bio, photo |

### Private: Customer (`verifyToken` + `verifyCustomer`)
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/bookings` | Create a repair request |
| GET | `/api/bookings/my` | Own bookings |
| PATCH | `/api/bookings/:id/cancel` | Cancel while `requested` |
| POST | `/api/payments/create-checkout-session` | Start Stripe Checkout |
| GET | `/api/payments/verify?session_id=` | Verify and save the payment |
| GET | `/api/payments/my` | Payment history (my addition) |
| GET | `/api/customer/stats` | Overview cards and charts (my addition) |

### Private: Technician (`verifyToken` + `verifyTechnician`)
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/services` | Add a service (saved as pending) |
| GET | `/api/services/my` | Own services (my addition) |
| PATCH | `/api/services/:id` | Edit (resets to pending) and toggle availability |
| DELETE | `/api/services/:id` | Delete |
| GET | `/api/bookings/technician` | Incoming requests |
| PATCH | `/api/bookings/:id/status` | Move the job through the pipeline |
| GET | `/api/technician/stats` | Overview cards and charts (my addition) |

### Private: Admin (`verifyToken` + `verifyAdmin`)
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/users` | All users |
| PATCH | `/api/admin/users/:id/role` | Change role (not your own) |
| GET | `/api/admin/services` | All services for moderation (my addition) |
| PATCH | `/api/admin/services/:id/approval` | Approve or reject |
| GET | `/api/admin/bookings` | All bookings |
| GET | `/api/admin/payments` | All payments with total revenue |
| GET | `/api/admin/stats` | Overview cards and charts (my addition) |

Endpoints marked "my addition" are not listed in the brief, but the pages need them. The brief doesn't say whether the admin services table uses a separate endpoint, so that one is my assumption. You could also reuse another route.

---

## Summary

| | Public | Private | Total |
|---|---|---|---|
| **Frontend pages** | 7 | 15 | **22** |
| **Backend endpoints** | 3 | about 21 | **about 24** |

Sign In and Sign Up are public but guest-only, so logged-in users are bounced away from them. The Stripe webhook is public but protected by signature verification instead of JWT.

Would you like the folder structure for both repos next?