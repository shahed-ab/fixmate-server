import { MongoClient } from 'mongodb';

let cachedClient = null;
let cachedDb = null;

/**
 * Connects to MongoDB with connection caching for serverless / persistent environments.
 */
export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.DB_NAME || 'fixmate';

  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

/**
 * Helper to retrieve the 4 core collections.
 * "users" corresponds to the "user" collection used by BetterAuth.
 */
export function getCollections(db) {
  const activeDb = db || cachedDb;
  if (!activeDb) {
    throw new Error('Database is not connected. Call connectToDatabase() first.');
  }

  return {
    users: activeDb.collection('user'),
    services: activeDb.collection('services'),
    bookings: activeDb.collection('bookings'),
    payments: activeDb.collection('payments'),
  };
}

/**
 * Creates required indexes across all collections per PLAN.md Section 3.
 */
export async function createIndexes(db) {
  const collections = getCollections(db);

  // 1. users indexes
  await collections.users.createIndex({ email: 1 }, { unique: true });
  await collections.users.createIndex({ role: 1 });

  // 2. services indexes
  await collections.services.createIndex({ approvalStatus: 1, isAvailable: 1, createdAt: -1 });
  await collections.services.createIndex({ technicianEmail: 1 });
  await collections.services.createIndex({ category: 1 });
  await collections.services.createIndex({ title: 'text', category: 'text' });

  // 3. bookings indexes
  await collections.bookings.createIndex({ customerEmail: 1, createdAt: -1 });
  await collections.bookings.createIndex({ technicianEmail: 1, status: 1 });
  await collections.bookings.createIndex({ serviceId: 1, customerEmail: 1, status: 1 });

  // 4. payments indexes
  await collections.payments.createIndex({ stripeSessionId: 1 }, { unique: true, sparse: true });
  await collections.payments.createIndex({ bookingId: 1 }, { unique: true, sparse: true });
  await collections.payments.createIndex({ customerEmail: 1 });
  await collections.payments.createIndex({ technicianEmail: 1 });
}
