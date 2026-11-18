import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

let stripeInstance = null;

/**
 * Returns a cached singleton instance of the Stripe SDK initialized with STRIPE_SECRET_KEY.
 */
export function getStripe() {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      console.warn('Warning: STRIPE_SECRET_KEY is not configured in environment variables');
    }
    stripeInstance = new Stripe(secretKey || '');
  }
  return stripeInstance;
}

export default getStripe;
