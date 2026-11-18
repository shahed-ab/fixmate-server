import express from 'express';
import dotenv from 'dotenv';
import corsMiddleware from './config/cors.js';
import { notFoundHandler, errorHandler } from './middlewares/errorHandlers.js';

dotenv.config();

const app = express();

// Enable CORS
app.use(corsMiddleware);

// ============================================================================
// STRIPE WEBHOOK RAW-BODY ROUTE PLACEHOLDER (Step S6)
// Route: POST /api/webhook/stripe
// Must be registered BEFORE express.json() to accept raw body (express.raw)
// for Stripe signature verification.
// ============================================================================

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
