import cors from 'cors';

const getAllowedOrigins = () => {
  const rawOrigins = process.env.CLIENT_URL || 'http://localhost:3000';
  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    // Allow requests with no origin (e.g., mobile apps, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error(`CORS error: Origin ${origin} not allowed`));
  },
  credentials: true,
};

const corsMiddleware = cors(corsOptions);

export default corsMiddleware;
