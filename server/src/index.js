import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import dotenv from 'dotenv';
import corsMiddleware from './config/cors.js';
import { notFoundHandler, errorHandler } from './middlewares/errorHandlers.js';
import servicesRouter from './routes/services.js';
import adminRouter from './routes/admin.js';
import usersRouter from './routes/users.js';
import bookingsRouter from './routes/bookings.js';
import paymentsRouter, { stripeWebhookHandler } from './routes/payments.js';
import statsRouter from './routes/stats.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server/.env if present, falling back to process cwd
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const app = express();

// Enable CORS
app.use(corsMiddleware);

// ============================================================================
// STRIPE WEBHOOK RAW-BODY ROUTE (Step S6)
// Route: POST /api/webhook/stripe
// Must be registered BEFORE express.json() to accept raw body (express.raw)
// for Stripe signature verification.
// ============================================================================
app.post('/api/webhook/stripe', express.raw({ type: 'application/json' }), stripeWebhookHandler);

// Parse JSON request bodies
app.use(express.json());

// Root status endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'FixMate API Server is running',
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    time: new Date().toISOString(),
  });
});

// Services API routes (Step S3)
app.use('/api/services', servicesRouter);

// Admin API routes (Step S4)
app.use('/api/admin', adminRouter);

// Users API routes (Step S4)
app.use('/api/users', usersRouter);

// Bookings API routes (Step S5)
app.use('/api/bookings', bookingsRouter);

// Payments API routes (Step S6)
app.use('/api/payments', paymentsRouter);

// Stats API routes (Step S7)
// Endpoints: GET /api/customer/stats, /api/technician/stats, /api/admin/stats, public GET /api/stats
app.use('/api', statsRouter);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Start HTTP server only when not running on Vercel
const PORT = process.env.PORT || 5000;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`FixMate API server listening on port ${PORT}`);
  });
}

export default app;
