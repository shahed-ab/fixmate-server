import { createRemoteJWKSet, jwtVerify } from 'jose';
import { connectToDatabase, getCollections } from '../db.js';

let cachedJwks = null;
let cachedJwksUrl = null;

/**
 * Returns a cached remote JWKS instance for the configured JWKS_URL.
 */
export function getJWKS() {
  const currentUrl =
    process.env.JWKS_URL ||
    (process.env.CLIENT_URL ? `${process.env.CLIENT_URL}/api/auth/jwks` : 'http://localhost:3000/api/auth/jwks');

  if (!cachedJwks || cachedJwksUrl !== currentUrl) {
    cachedJwks = createRemoteJWKSet(new URL(currentUrl));
    cachedJwksUrl = currentUrl;
  }
  return cachedJwks;
}

/**
 * Middleware to verify JWT token from Authorization header (Bearer token)
 * using Better Auth JWKS endpoint, fetch authoritative user from the "user"
 * collection in MongoDB by email, and attach req.user = { id, email, role, name }.
 *
 * Returns 401 if token is missing, invalid, expired, or user is not found in database.
 * Does NOT insert new users into MongoDB.
 */
export async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Bearer token required',
    });
  }

  const token = authHeader.split(' ')[1]?.trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Token missing',
    });
  }

  let payload;
  try {
    const JWKS = getJWKS();
    const verificationResult = await jwtVerify(token, JWKS);
    payload = verificationResult.payload;
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }

  try {
    const email = payload?.email;
    if (!email) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Token missing email claim',
      });
    }

    const { db } = await connectToDatabase();
    const collections = getCollections(db);
    const user = await collections.users.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User not found in database',
      });
    }

    req.user = {
      id: user._id ? user._id.toString() : (user.id || payload.sub),
      email: user.email,
      role: user.role,
      name: user.name,
    };

    next();
  } catch (dbError) {
    next(dbError);
  }
}

/**
 * Role middleware: requires req.user.role === 'customer'. Returns 403 otherwise.
 */
export function verifyCustomer(req, res, next) {
  if (!req.user || req.user.role !== 'customer') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Customer access required',
    });
  }
  next();
}

/**
 * Role middleware: requires req.user.role === 'technician'. Returns 403 otherwise.
 */
export function verifyTechnician(req, res, next) {
  if (!req.user || req.user.role !== 'technician') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Technician access required',
    });
  }
  next();
}

/**
 * Role middleware: requires req.user.role === 'admin'. Returns 403 otherwise.
 */
export function verifyAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Admin access required',
    });
  }
  next();
}
