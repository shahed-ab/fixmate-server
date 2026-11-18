import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { connectToDatabase, getCollections } from '../db.js';
import { verifyToken, verifyCustomer } from '../middlewares/auth.js';
import getStripe from '../config/stripe.js';

const router = Router();

/**
 * Escapes special regex characters.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Shared Idempotent Payment Fulfillment Function.
 * Used by both GET /api/payments/verify and POST /api/webhook/stripe.
 *
 * Rules:
 * - Only fulfills if session.status === 'complete' and session.payment_status === 'paid'
 * - Idempotent: checks payments collection by stripeSessionId / bookingId
 * - Ignores duplicate key error (code 11000)
 * - Updates booking paymentStatus strictly filtered by paymentStatus: 'unpaid'
 */
export async function fulfillPayment(session, db) {
  if (session.status !== 'complete' || session.payment_status !== 'paid') {
    return {
      success: false,
      message: 'Payment has not been completed',
    };
  }

  const bookingId = session.metadata?.bookingId;
  const customerEmail = session.metadata?.customerEmail;
  const stripeSessionId = session.id;
  const transactionId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id || stripeSessionId;
  const amount = session.amount_total ? session.amount_total / 100 : 0;

  if (!bookingId || !ObjectId.isValid(bookingId)) {
    throw new Error('Invalid or missing bookingId in session metadata');
  }

  const collections = getCollections(db);

  // Check if payment already exists
  const existingPayment = await collections.payments.findOne({
    $or: [{ stripeSessionId }, { bookingId }],
  });

  if (existingPayment) {
    return {
      success: true,
      message: 'Payment has already been processed',
      payment: existingPayment,
      alreadyProcessed: true,
    };
  }

  // Load the booking to copy snapshot details
  const booking = await collections.bookings.findOne({ _id: new ObjectId(bookingId) });
  if (!booking) {
    throw new Error(`Booking ${bookingId} not found for payment fulfillment`);
  }

  const paymentDoc = {
    bookingId: booking._id.toString(),
    serviceTitle: booking.serviceTitle,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail || customerEmail,
    technicianName: booking.technicianName,
    technicianEmail: booking.technicianEmail,
    amount: amount || booking.finalAmount,
    currency: 'usd',
    transactionId,
    stripeSessionId,
    paymentStatus: 'paid',
    paidAt: new Date(),
  };

  try {
    const insertResult = await collections.payments.insertOne(paymentDoc);
    paymentDoc._id = insertResult.insertedId;
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate key error - concurrent fulfillment
      const duplicateRecord = await collections.payments.findOne({ stripeSessionId });
      return {
        success: true,
        message: 'Payment has already been processed',
        payment: duplicateRecord,
        alreadyProcessed: true,
      };
    }
    throw err;
  }

  // Update booking status filtered by paymentStatus: 'unpaid'
  await collections.bookings.updateOne(
    { _id: new ObjectId(bookingId), paymentStatus: 'unpaid' },
    { $set: { paymentStatus: 'paid', updatedAt: new Date() } }
  );

  return {
    success: true,
    message: 'Payment fulfilled successfully',
    payment: paymentDoc,
  };
}

/**
 * POST /api/payments/create-checkout-session
 * Customer: Initiates a Stripe Checkout Session for a completed booking.
 * Validations:
 *  - Booking must exist and belong to req.user.email
 *  - Booking status must be 'completed'
 *  - Booking paymentStatus must be 'unpaid'
 *  - unit_amount = Math.round(finalAmount * 100)
 */
router.post('/create-checkout-session', verifyToken, verifyCustomer, async (req, res, next) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId || !ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid bookingId is required',
      });
    }

    const { db } = await connectToDatabase();
    const collections = getCollections(db);

    const booking = await collections.bookings.findOne({ _id: new ObjectId(bookingId) });
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Ownership check
    if (booking.customerEmail.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only pay for your own bookings',
      });
    }

    // Status check
    if (booking.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Payment is only permitted for completed bookings',
      });
    }

    // PaymentStatus check
    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'This booking has already been paid',
      });
    }

    const unitAmount = Math.round((booking.finalAmount || booking.basePrice || 0) * 100);
    if (unitAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking amount. Must be greater than 0',
      });
    }

    const stripe = getStripe();
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: req.user.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: booking.serviceTitle,
              description: `Repair service provided by ${booking.technicianName}`,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        bookingId: booking._id.toString(),
        customerEmail: req.user.email,
      },
      success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/payment/cancel`,
    });

    res.status(200).json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/payments/verify?session_id=
 * Customer: Verifies Stripe Checkout Session and fulfills payment idempotently.
 * Called by /payment/success client page.
 */
router.get('/verify', verifyToken, verifyCustomer, async (req, res, next) => {
  try {
    const { session_id } = req.query;

    if (!session_id || typeof session_id !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'session_id query parameter is required',
      });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Stripe session not found',
      });
    }

    // Verify session belongs to req.user.email
    if (
      !session.metadata ||
      session.metadata.customerEmail?.toLowerCase() !== req.user.email.toLowerCase()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Session does not belong to logged-in user',
      });
    }

    const { db } = await connectToDatabase();
    const result = await fulfillPayment(session, db);

    res.status(200).json({
      success: true,
      message: result.message,
      payment: result.payment,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/payments/my
 * Customer: Returns payment history for the logged-in customer.
 */
router.get('/my', verifyToken, verifyCustomer, async (req, res, next) => {
  try {
    const { db } = await connectToDatabase();
    const collections = getCollections(db);

    const payments = await collections.payments
      .find({
        customerEmail: { $regex: new RegExp(`^${escapeRegex(req.user.email)}$`, 'i') },
      })
      .sort({ paidAt: -1, createdAt: -1 })
      .toArray();

    res.status(200).json(payments);
  } catch (error) {
    next(error);
  }
});

/**
 * Stripe Webhook Handler (POST /api/webhook/stripe)
 * Registered before express.json() with express.raw.
 *
 * Rules:
 * - If STRIPE_WEBHOOK_SECRET is empty, return 200 and skip processing (per instructions).
 * - Otherwise, verify signature and handle checkout.session.completed with fulfillPayment.
 */
export async function stripeWebhookHandler(req, res, next) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    // Skip processing gracefully when webhook secret is empty in dev
    return res.status(200).json({
      received: true,
      skipped: 'STRIPE_WEBHOOK_SECRET is not configured',
    });
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return res.status(400).send('Missing stripe-signature header');
  }

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { db } = await connectToDatabase();
      await fulfillPayment(session, db);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

export default router;
