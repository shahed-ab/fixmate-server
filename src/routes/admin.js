import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { connectToDatabase, getCollections } from '../db.js';
import { verifyToken, verifyAdmin } from '../middlewares/auth.js';
import { getAdminStatsHandler } from './stats.js';

const router = Router();

// Apply verifyToken and verifyAdmin to all admin routes
router.use(verifyToken, verifyAdmin);

/**
 * GET /api/admin/stats (Step S7)
 * Admin executive metrics: total users, technicians, pending services,
 * revenue by month, bookings by status.
 */
router.get('/stats', getAdminStatsHandler);

const VALID_ROLES = ['customer', 'technician', 'admin'];

/**
 * GET /api/admin/users
 * Lists all registered users on the platform.
 */
router.get('/users', async (req, res, next) => {
  try {
    const { db } = await connectToDatabase();
    const collections = getCollections(db);

    const users = await collections.users
      .find({}, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/users/:id/role
 * Changes user role (customer | technician | admin).
 * Forbidden to change own role.
 */
router.patch('/users/:id/role', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed roles: ${VALID_ROLES.join(', ')}`,
      });
    }

    const { db } = await connectToDatabase();
    const collections = getCollections(db);

    let targetUser = null;
    if (ObjectId.isValid(id)) {
      targetUser = await collections.users.findOne({ _id: new ObjectId(id) });
    }
    if (!targetUser) {
      targetUser = await collections.users.findOne({ _id: id });
    }
    if (!targetUser) {
      targetUser = await collections.users.findOne({ id: id });
    }

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Admin cannot change their own administrative role
    if (
      targetUser.email.toLowerCase() === req.user.email.toLowerCase() ||
      targetUser._id.toString() === req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You cannot change your own administrative role',
      });
    }

    await collections.users.updateOne(
      { _id: targetUser._id },
      { $set: { role, updatedAt: new Date() } }
    );

    const updatedUser = await collections.users.findOne(
      { _id: targetUser._id },
      { projection: { password: 0 } }
    );

    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/services?status=
 * Lists services for admin moderation.
 * Supports ?status= query filter (all, pending, approved, rejected).
 * Pending services are prioritized first when viewing all.
 */
router.get('/services', async (req, res, next) => {
  try {
    const { status } = req.query;
    const { db } = await connectToDatabase();
    const collections = getCollections(db);

    const query = {};
    if (status && status !== 'all') {
      query.approvalStatus = status;
    }

    const services = await collections.services
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // Priority sort: pending first when all or unspecified
    if (!status || status === 'all') {
      services.sort((a, b) => {
        if (a.approvalStatus === 'pending' && b.approvalStatus !== 'pending') return -1;
        if (a.approvalStatus !== 'pending' && b.approvalStatus === 'pending') return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }

    res.status(200).json(services);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/services/:id/approval
 * Moderates service: updates approvalStatus to 'approved' or 'rejected'.
 */
router.patch('/services/:id/approval', async (req, res, next) => {
  try {
    const { id } = req.params;
    const approvalStatus = req.body.approvalStatus || req.body.status;

    if (!['approved', 'rejected'].includes(approvalStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid approval status. Must be "approved" or "rejected"',
      });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Service not found or invalid ID',
      });
    }

    const { db } = await connectToDatabase();
    const collections = getCollections(db);

    const service = await collections.services.findOne({ _id: new ObjectId(id) });
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    await collections.services.updateOne(
      { _id: new ObjectId(id) },
      { $set: { approvalStatus, updatedAt: new Date() } }
    );

    const updatedService = await collections.services.findOne({ _id: new ObjectId(id) });

    res.status(200).json({
      success: true,
      message: `Service ${approvalStatus} successfully`,
      service: updatedService,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/bookings?status=
 * Read-only monitoring of all platform bookings.
 * Supports ?status= query filter.
 */
router.get('/bookings', async (req, res, next) => {
  try {
    const { status } = req.query;
    const { db } = await connectToDatabase();
    const collections = getCollections(db);

    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const bookings = await collections.bookings
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(bookings);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/payments
 * Lists all transactions with platform totalRevenue aggregation.
 */
router.get('/payments', async (req, res, next) => {
  try {
    const { db } = await connectToDatabase();
    const collections = getCollections(db);

    const payments = await collections.payments
      .find({})
      .sort({ paidAt: -1, createdAt: -1 })
      .toArray();

    const totalRevenue = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    res.status(200).json({
      payments,
      totalRevenue,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
