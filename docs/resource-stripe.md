# Stripe Payment Integration — Complete Guide

> **Stack:** Stripe · Next.js 14+ · Express · MongoDB
> 
> 
> **Purpose:** Everything you need to accept payments, subscriptions, and webhooks — structured so you can build any payment-powered product.
> 

---

## Table of Contents

1. Core Concepts
2. Setup & Configuration
3. Creating a Checkout Session
4. Handling the Success Page
5. Webhooks — Production-Grade Approach
6. Payment Types — Patterns for Every Use Case
7. Express Backend — Saving to MongoDB
8. Testing
9. Common Errors & Fixes
10. Quick Reference

Stripe : http://stripe.com/

Stripe Docs: https://docs.stripe.com/checkout/quickstart?client=next&lang=node 

Ceckout Session Docs: https://docs.stripe.com/api/checkout/sessions/create 

---

## 1. Core Concepts

Before writing any code, understand the key Stripe objects.

| Object | What it is |
| --- | --- |
| **Stripe Account** | Your account on `dashboard.stripe.com`. Has **test mode** and **live mode** — always develop in test mode. |
| **API Keys** | **Secret key** (`sk_test_...`) — server only. **Publishable key** (`pk_test_...`) — safe for the browser. |
| **PaymentIntent** | Tracks a single payment lifecycle: created → processing → succeeded / failed. |
| **Checkout Session** | A hosted Stripe UI page. Easiest way to accept payments — Stripe handles card forms, validation, 3DS. |
| **Subscription** | Recurring billing. A Customer is billed for a Price on a recurring Interval (monthly, yearly). |
| **Webhook** | Stripe sends an HTTP `POST` to your server when events happen — payment succeeded, subscription renewed, etc. |
| **Product & Price** | A **Product** is what you sell. A **Price** is its cost and billing frequency. One product can have many prices. |
| **Customer** | A Stripe object for your user. Stores saved cards, billing history, subscriptions, and metadata. |
| **metadata** | A key-value store you attach to Stripe objects. Use this to carry your app's data (userId, orderId) through Stripe. Max 50 keys, 500 chars per value. |

### End-to-End Payment Flow

```
User clicks Pay
  → Your Next.js API Route
    → Stripe creates Session
      → Redirect to Stripe Hosted UI
        → User pays
          → Stripe processes payment
            → Redirect to your success_url
              → Your success page verifies session
                → POST to your Express API
                  → MongoDB updated
                  + Stripe fires webhook (independently)
```

> **Critical Rule — Stripe amounts are always in the smallest currency unit.**
For USD that means **cents**. `$25.00 = 2500`. `$0.50 = 50`.
If you forget to multiply by `100`, you charge 100× less than intended.
> 

---

## 2. Setup & Configuration

### Step 1 — Install the Stripe SDK

```bash
npm install --save stripe @stripe/stripe-js next
```

### Step 2 — Environment Variables

```bash
# .env.local

# Server-only — NEVER prefix with NEXT_PUBLIC_
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxx

# Safe to expose to the browser
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxx

# For webhook signature verification (see Section 5)
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx

# Your Express backend
NEXT_PUBLIC_API_URL=http://localhost:5000
```

> **Warning:** Never add `NEXT_PUBLIC_` to `STRIPE_SECRET_KEY`. This exposes it to every browser that loads your app — anyone can then make charges on your behalf.
> 

### Step 3 — Shared Stripe Instance

Create one file and import it everywhere you need Stripe on the server.

```jsx
// /lib/stripe.js
import 'server-only'    // throws a build error if imported in a client component
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Optional: pin the API version for stability
export const stripeWithVersion = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
})
```

### Step 4 — Create Products & Prices (Dashboard)

For **fixed subscriptions** (e.g. a premium plan):

- Go to `dashboard.stripe.com → Products → Add product`
- Set the price and billing interval (monthly / yearly)
- Copy the **Price ID** — it looks like `price_1NxxxxxxxxxxxxABCD`

For **dynamic prices** (e.g. event tickets with variable amounts):

- You do **not** need to pre-create anything — pass `price_data` inline in the API route (see Section 3)

---

## 3. Creating a Checkout Session

### Step 1 — Frontend (Client Component)

Call your own API route with `fetch`. Never call Stripe directly from the client — your secret key would be exposed.

```jsx
// Any 'use client' component
'use client'

const handleCheckout = async () => {
  const res = await fetch('/api/checkout_sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'ticket',              // tells the API which payment mode to use
      eventId:          event._id,
      eventTitle:       event.title,
      quantity:         qty,
      totalTicketPrice: qty * event.price,
    }),
  })

  const { url, error } = await res.json()

  if (error) { console.error(error); return }
  if (url)   window.location.assign(url)   // redirect to Stripe Checkout
}

// In JSX
<button onClick={handleCheckout}>Pay ${qty * event.price}</button>
```

### Step 2 — API Route (Server)

```jsx
// /app/api/checkout_sessions/route.js
import { NextResponse } from 'next/server'
import { headers }      from 'next/headers'
import { stripe }       from '@/lib/stripe'

export async function POST(req) {
  try {
    const origin   = (await headers()).get('origin')
    const body     = await req.json()
    const { type } = body

    // ── 1. Build line item based on payment type ───────────────────
    let lineItem, metadata = {}, mode, successUrl

    if (type === 'subscription') {
      // Fixed plan: use a pre-created Price ID from the Stripe dashboard
      lineItem   = { price: "price_1TfcIkKExS1h0fIIuuxbZXVi", quantity: 1 } // price id from stripe dashboard
      mode       = 'subscription'
      successUrl = `${origin}/dashboard/premium-success?session_id={CHECKOUT_SESSION_ID}`

    } else {
      // Dynamic price: pass price_data inline (no dashboard setup required)
      lineItem = {
        price_data: {
          currency:     'usd',
          unit_amount:  body.totalTicketPrice * 100,  // ALWAYS multiply by 100 for cents
          product_data: { name: body.eventTitle },
        },
        quantity: body.quantity,
      }
      mode       = 'payment'
      successUrl = `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`

      // Store whatever you need to identify this transaction later
      metadata = {
        userId:     body.userId     || '',
        eventId:    body.eventId    || '',
        eventTitle: body.eventTitle || '',
        quantity:   body.quantity   || 1,
        amount:     body.totalTicketPrice || 0,
      }
    }

    // ── 2. Create the Stripe Checkout Session ──────────────────────
    const session = await stripe.checkout.sessions.create({
      line_items:     [lineItem],
      mode,
      metadata,
      success_url:    successUrl,
      cancel_url:     `${origin}/payment-cancelled`,
      customer_email: body.email || undefined,   // optional: pre-fill email
    })

    return NextResponse.json({ url: session.url })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: err.statusCode || 500 })
  }
}
```

> **Note:** `{CHECKOUT_SESSION_ID}` inside `success_url` is a **Stripe template variable** — Stripe replaces it with the real session ID automatically. Do not change this string.
> 

### Session Modes

| mode | Use case | What Stripe creates |
| --- | --- | --- |
| `payment` | One-time charge (ticket, product, donation) | PaymentIntent + Charge |
| `subscription` | Recurring billing (monthly plan, SaaS) | Subscription + recurring Invoices |
| `setup` | Save a card without charging (charge later) | SetupIntent + PaymentMethod |

---

## 4. Handling the Success Page

Stripe redirects the user here after payment. **Always retrieve the session from Stripe server-side** and check `status === 'complete'` before doing anything. Do not trust the URL parameters alone.

```jsx
// /app/payment-success/page.jsx
// This is a Server Component — do NOT add 'use client'

import { redirect }  from 'next/navigation'
import { stripe }    from '@/lib/stripe'
import { auth }      from '@/lib/auth'
import { headers }   from 'next/headers'

export default async function PaymentSuccessPage({ searchParams }) {
  const { session_id } = await searchParams
  if (!session_id) redirect('/')

  // ── Step 1: Retrieve session from Stripe (server-side) ────────
  let session
  try {
    session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['line_items', 'payment_intent', 'customer_details'],
    })
  } catch { redirect('/') }

  // ── Step 2: Guard — only 'complete' means money was received ──
  if (session.status !== 'complete') redirect('/')

  // ── Step 3: Get auth token to call your Express API ───────────
  const { token } = await auth.api.getToken({ headers: await headers() })

  // ── Step 4: Save to your database ─────────────────────────────
  await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...session.metadata,                          // all data you stored at checkout
      transactionId:  session.payment_intent,       // Stripe PaymentIntent ID: pi_xxx
      customerEmail:  session.customer_details?.email,
      amountPaid:     session.amount_total / 100,   // back to dollars
    }),
  })

  // ── Step 5: Render success UI ──────────────────────────────────
  return (
    <div>
      <h1>Payment successful!</h1>
      <p>Order: {session.metadata.orderId}</p>
      <p>Paid: ${session.amount_total / 100}</p>
    </div>
  )
}
```

### Session Status Values

| status | Meaning | What to do |
| --- | --- | --- |
| `complete` | Payment succeeded | Save to DB, show success UI |
| `open` | Payment not yet completed | Redirect back to checkout or homepage |
| `expired` | User abandoned — session timed out (24h) | Redirect to homepage |

### Using `expand` to Get Related Objects

Some fields (`payment_intent`, `line_items`) return only an ID by default. Use `expand` to get the full objects in one API call.

```jsx
const session = await stripe.checkout.sessions.retrieve(session_id, {
  expand: [
    'payment_intent',       // full PaymentIntent object
    'line_items',           // what was purchased
    'customer',             // Stripe Customer object (if applicable)
    'customer_details',     // name, email, address entered at checkout
  ]
})
```

---

## 5. Webhooks — Production-Grade Approach

> **Why webhooks?** The success page approach fails if the user closes the browser before the page loads — your database never gets updated. Webhooks fire regardless of what the user does after payment.
> 

### How Webhooks Work

1. User pays on Stripe
2. Stripe fires an event (e.g. `checkout.session.completed`)
3. Stripe sends a signed `POST` request to your endpoint (e.g. `https://yoursite.com/api/webhooks/stripe`)
4. Your server **verifies the signature** and updates your database
5. Return `200` — if you return anything else, Stripe retries the event

### Webhook Endpoint in Next.js

```jsx
// /app/api/webhooks/stripe/route.js
import { NextResponse } from 'next/server'
import { stripe }        from '@/lib/stripe'

// CRITICAL: disable body parsing — Stripe needs raw bytes to verify the signature
export const config = { api: { bodyParser: false } }

export async function POST(req) {
  const body      = await req.text()                       // raw string, NOT JSON
  const signature = req.headers.get('stripe-signature')

  let event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    // Signature mismatch — reject the request (could be a forgery)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // ── Route by event type ────────────────────────────────────────
  switch (event.type) {

    case 'checkout.session.completed': {
      const session = event.data.object
      if (session.payment_status === 'paid') {
        await fulfillOrder(session)     // your function: save booking to DB
      }
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object
      await renewSubscription(invoice) // e.g. extend user's plan expiry in DB
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object
      await cancelSubscription(sub)    // revoke user's access
      break
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object
      await notifyUser(pi)             // email user about the failure
      break
    }

    default:
      // Safely ignore events you don't handle
  }

  return NextResponse.json({ received: true })
}

// ── Example fulfillment function ──────────────────────────────────
async function fulfillOrder(session) {
  // session.metadata contains everything you stored at checkout creation
  const { userId, eventId, quantity, amount } = session.metadata
  // ... insert booking to MongoDB, send confirmation email, etc.
}
```

> **Critical:** Use `req.text()` not `req.json()`. If the body is parsed as JSON before `constructEvent`, the signature check will always fail.
> 

### Testing Webhooks Locally (Stripe CLI)

Stripe can't reach `localhost` from the internet. Use the Stripe CLI to tunnel events.

```bash
# 1. Install Stripe CLI (once)
brew install stripe/stripe-cli/stripe       # macOS
# Windows: choco install stripe-cli

# 2. Login
stripe login

# 3. Forward Stripe events to your local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# ↑ Copy the 'whsec_...' key printed — paste it into STRIPE_WEBHOOK_SECRET in .env.local

# 4. In a separate terminal — trigger a test event manually
stripe trigger checkout.session.completed
```

> **Note:** The webhook secret from `stripe listen` is different from the dashboard webhook secret. Use the CLI one for local dev only. For production, create a webhook endpoint in the Stripe Dashboard and use that secret.
> 

### Important Webhook Events

| Event | When it fires |
| --- | --- |
| `checkout.session.completed` | User completes the Stripe Checkout form |
| `payment_intent.succeeded` | A one-time payment is confirmed |
| `payment_intent.payment_failed` | Payment was declined or failed |
| `invoice.payment_succeeded` | Subscription renews successfully |
| `invoice.payment_failed` | Subscription renewal failed (e.g. expired card) |
| `customer.subscription.created` | A new subscription starts |
| `customer.subscription.deleted` | Subscription cancelled or expired |
| `customer.subscription.updated` | Plan changed, trial ended, etc. |

---

## 6. Payment Types — Patterns for Every Use Case

### A — One-Time Payment (e-commerce, tickets, donations)

```jsx
stripe.checkout.sessions.create({
  mode: 'payment',
  line_items: [{
    price_data: {
      currency:     'usd',
      unit_amount:  2999,   // $29.99 — always in cents
      product_data: { name: 'Programming Hero T-Shirt' },
    },
    quantity: 2,
  }],
  success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url:  `${origin}/shop`,
})
```

### B — Recurring Subscription (SaaS, membership)

```jsx
// First create a Price in the dashboard (e.g. $9.99/month)
// Price ID looks like: price_1NxxxxxxxxxxxxABCD

stripe.checkout.sessions.create({
  mode:           'subscription',
  line_items: [{ price: 'price_1NxxxxxxxxxxxxABCD', quantity: 1 }],
  success_url:    `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url:     `${origin}/pricing`,
  customer_email: user.email,      // pre-fill email field on Stripe page
})
```

### C — Free Trial, Then Subscription

```jsx
stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{ price: 'price_1NxxxxxxxxxxxxABCD', quantity: 1 }],
  subscription_data: {
    trial_period_days: 14,   // 14-day free trial — card saved but not charged
  },
  success_url: `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url:  `${origin}/pricing`,
})
```

### D — Custom Amount (Donations, Pay-What-You-Want)

```jsx
// Frontend: let user type an amount
const res = await fetch('/api/checkout_sessions', {
  method: 'POST',
  body: JSON.stringify({ amount: customAmountInDollars })
})

// API route: use price_data with dynamic unit_amount
price_data: {
  currency:     'usd',
  unit_amount:  body.amount * 100,    // convert dollars to cents
  product_data: { name: 'Donation' },
}
```

### E — Multiple Items in One Checkout (Cart)

```jsx
const cartItems = [
  { name: 'T-Shirt', price: 2999, quantity: 2 },
  { name: 'Hoodie',  price: 5999, quantity: 1 },
]

stripe.checkout.sessions.create({
  mode: 'payment',
  line_items: cartItems.map(item => ({
    price_data: {
      currency:     'usd',
      unit_amount:  item.price,
      product_data: { name: item.name },
    },
    quantity: item.quantity,
  })),
  success_url: `${origin}/order-confirmed?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url:  `${origin}/cart`,
})
```

### F — Cancel a Subscription

```jsx
// Cancel immediately (access revoked now)
await stripe.subscriptions.cancel(subscriptionId)

// Cancel at period end (user keeps access until billing cycle ends)
await stripe.subscriptions.update(subscriptionId, {
  cancel_at_period_end: true
})
```

> **Always** listen to the `customer.subscription.deleted` webhook to revoke access — do not rely on the API response alone.
> 

### G — Save a Card Without Charging (Charge Later)

```jsx
stripe.checkout.sessions.create({
  mode: 'setup',
  success_url: `${origin}/card-saved?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url:  `${origin}/billing`,
  customer:    stripeCustomerId,   // must already have a Customer object
})
```

---

## 7. Express Backend — Saving to MongoDB

```jsx
// POST /api/bookings
app.post('/api/bookings', verifyToken, verifyAttendee, async (req, res) => {
  try {
    const {
      amount, email: attendeeEmail,
      eventId, eventTitle,
      quantity, transactionId,
    } = req.body

    const qty = parseInt(quantity)

    // ── 1. Deduct seats atomically ─────────────────────────────
    await eventsCollection.updateOne(
      { _id: new ObjectId(eventId) },
      { $inc: { availableSeats: -qty } }
    )

    // ── 2. Insert booking document ─────────────────────────────
    const booking = {
      eventId,
      eventTitle,
      attendeeEmail,
      quantity:      qty,
      amount:        parseFloat(amount),
      transactionId,
      paymentStatus: 'paid',
      bookingDate:   new Date(),
    }
    const result = await bookingsCollection.insertOne(booking)

    // ── 3. Log payment separately ──────────────────────────────
    await paymentsCollection.insertOne({
      userEmail:     attendeeEmail,
      amount:        parseFloat(amount),
      transactionId,
      paymentStatus: 'paid',
      paidAt:        new Date(),
    })

    res.json({ success: true, booking: { _id: result.insertedId, ...booking } })

  } catch (error) {
    console.error(error)
    res.status(500).json({ message: error.message })
  }
})
```

> **Idempotency tip:** Before inserting, check if `transactionId` already exists in your collection. This prevents duplicate entries if the success page and webhook both try to write the same payment.
> 
> 
> ```jsx
> const existing = await bookingsCollection.findOne({ transactionId })
> if (existing) return res.json({ success: true, booking: existing })
> ```
> 

---

## 8. Testing

### Test Card Numbers

Use these on the Stripe Checkout page when your app redirects there.

Use any **future expiry date**, any **3-digit CVC**, and any **zip code**.

| Scenario | Card Number |
| --- | --- |
| ✅ Payment succeeds | `4242 4242 4242 4242` |
| ❌ Card declined (generic) | `4000 0000 0000 0002` |
| 🔐 Requires 3D Secure | `4000 0025 0000 3155` |
| 💳 Insufficient funds | `4000 0000 0000 9995` |
| ⏰ Expired card | `4000 0000 0000 0069` |
| ❓ Incorrect CVC | `4000 0000 0000 0127` |
| 🔄 Always requires authentication | `4000 0027 6000 3184` |

> In test mode, no real money moves. Test and live keys are completely separate — `sk_test_...` keys never affect real payments.
> 

### Stripe Dashboard Verification Checklist

| What to check | Where to find it |
| --- | --- |
| Session was created | Dashboard → Payments |
| Payment was received | Dashboard → Payments |
| Webhook was delivered | Dashboard → Developers → Webhooks → click your endpoint |
| Full event payload | Webhook detail → click any event row |
| Subscription status | Dashboard → Billing → Subscriptions |
| Customer was created | Dashboard → Customers |

---

## 9. Common Errors & Fixes

### `No such price: 'price_xxxxx'`

The Price ID does not exist in your **test** account. Check you copied it from the correct Stripe mode (test vs live). Test keys only work with test-mode products.

---

### `Invalid API key provided`

Your `STRIPE_SECRET_KEY` env variable is missing or wrong. Restart your dev server after changing `.env.local`. In development it must start with `sk_test_`.

---

### `Webhook signature verification failed`

Two common causes:

1. You are parsing the body as JSON before passing it to `constructEvent` — use `req.text()` not `req.json()`
2. You are using the wrong webhook secret — use the CLI secret (`whsec_...` printed by `stripe listen`) for local dev, not the dashboard secret

---

### `Amount must be at least $0.50 usd`

You passed `0.50` (dollars) instead of `50` (cents). Multiply all dollar amounts by `100` before passing to Stripe.

---

### `Cannot import server-only module on the client`

You imported `/lib/stripe.js` (which has `import 'server-only'`) inside a `'use client'` component. Move all Stripe calls to an API route or Server Action.

---

### Success page redirects back to home unexpectedly

Usually means the session `status` is `open` (not yet paid) or `expired`. Verify in the Stripe dashboard that the session ID in the URL corresponds to an actual completed payment. Also confirm your `success_url` includes `?session_id={CHECKOUT_SESSION_ID}` — with the curly braces intact.

---

### Duplicate database entries after payment

Both your success page **and** your webhook are writing to the DB. Choose one strategy:

- **Production:** use webhooks only. The success page should display UI without making a DB call.
- **Simple apps:** use the success page only. Make your DB write **idempotent** — check if `transactionId` already exists before inserting.

---

### Stripe Error Codes Reference

| Code | Meaning |
| --- | --- |
| `card_declined` | Generic decline — ask user to try a different card |
| `insufficient_funds` | Card balance too low |
| `expired_card` | Card is past its expiry date |
| `incorrect_cvc` | Wrong 3-digit security code |
| `processing_error` | Temporary Stripe issue — retry is safe |
| `rate_limit` | Too many API requests — add exponential backoff |
| `authentication_required` | Card needs 3D Secure — Checkout handles this automatically |

---

## 10. Quick Reference

### File Structure

```
/
├── .env.local                          ← API keys (never commit)
├── lib/
│   └── stripe.js                       ← shared Stripe instance (server-only)
├── app/
│   ├── api/
│   │   ├── checkout_sessions/
│   │   │   └── route.js                ← creates Stripe session, returns URL
│   │   └── webhooks/
│   │       └── stripe/
│   │           └── route.js            ← receives Stripe events, updates DB
│   ├── payment-success/
│   │   └── page.jsx                    ← verifies session, calls Express API
│   └── payment-cancelled/
│       └── page.jsx                    ← user cancelled checkout
└── (your-express-backend)/
    └── routes/
        └── bookings.js                 ← POST /api/bookings — saves to MongoDB
```

### Decision Tree — Which Approach?

```
Do you need recurring billing?
  ├── YES → mode: 'subscription' + Price ID from dashboard
  └── NO  → mode: 'payment'
              ├── Fixed price? → Price ID from dashboard
              └── Dynamic price? → price_data inline

Do you need to save a card without charging?
  └── YES → mode: 'setup'

Is the success page approach enough?
  ├── Simple project / learning → YES, use success page
  └── Production / user might close browser → NO, use webhooks
```

### Key Rules to Never Forget

1. **Secret key** — always `STRIPE_SECRET_KEY`, never `NEXT_PUBLIC_STRIPE_SECRET_KEY`
2. **Amounts** — always in cents. Multiply dollars × `100`
3. **Success page** — always verify `session.status === 'complete'` before writing to DB
4. **Webhooks** — always use `req.text()` not `req.json()` for signature verification
5. **`{CHECKOUT_SESSION_ID}`** — never modify this template variable in `success_url`
6. **Stripe calls** — always server-side only (API routes, Server Actions, Express)
7. **Idempotency** — check if `transactionId` already exists before inserting to prevent duplicates

---

*Last updated: June 2026 · Stripe SDK v14+ · Next.js 14 App Router*