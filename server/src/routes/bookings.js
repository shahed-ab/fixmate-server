import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { connectToDatabase, getCollections } from '../db.js';
import { verifyToken, verifyCustomer, verifyTechnician } from '../middlewares/auth.js';

const router = Router();

/**
 * Escapes characters with special meaning in RegExp to prevent regex injection.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strict Technician Status Transitions:
 * - requested -> accepted | rejected
 * - accepted -> in-progress
 * - in-progress -> completed (requires finalAmount > 0)
 * Final states (completed, rejected, cancelled) allow no further transitions.
 */
const VALID_TECHNICIAN_TRANSITIONS = {
  requested: ['accepted', 'rejected'],
  accepted: ['in-progress'],
  'in-progress': ['completed'],
  completed: [],
  rejected: [],
  cancelled: [],
};

/**
 * POST /api/bookings
 * Customer: Create a new repair booking.
 * Validations:
 *  - Service must be approved and available
 *  - Customer cannot book their own service
 *  - Customer cannot have duplicate active request (requested, accepted, in-progress) for the same service
 *  - phone, address, preferredDate (today or future), problemDescription (>= 20 chars)
 * Copies service and technician fields, sets finalAmount = basePrice, status = 'requested', paymentStatus = 'unpaid'.
 */
router.post('/', verifyToken, verifyCustomer, async (req, res, next) => {
  try {
    const {
      serviceId,
      customerPhone,
      phone,
      address,
      preferredDate,
      problemDescription,
    } = req.body;

    // 1. Validate serviceId format
    if (!serviceId || !ObjectId.isValid(serviceId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid serviceId is required',
      });
    }

    // 2. Validate required customer fields
    const contactPhone = (customerPhone || phone || '').trim();
    if (!contactPhone) {
      return res.status(400).json({
        success: false,
        message: 'Customer phone number is required',
      });
    }

    const serviceAddress = (address || '').trim();
    if (!serviceAddress) {
      return res.status(400).json({
        success: false,
        message: 'Service address is required',
      });
    }

    if (!preferredDate) {
      return res.status(400).json({
        success: false,
        message: 'Preferred service date is required',
      });
    }

    const parsedDate = new Date(preferredDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid preferred date format',
      });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStr = new Date().toISOString().split('T')[0];
    const inputDateStr = parsedDate.toISOString().split('T')[0];
    if (inputDateStr < todayStr && parsedDate < todayStart) {
      return res.status(400).json({
        success: false,
        message: 'Preferred date must be today or a future date',
      });
    }

    const description = (problemDescription || '').trim();
    if (!description || description.length < 20) {
      return res.status(400).json({
        success: false,
        message: 'Problem description must be at least 20 characters',
      });
    }

    const { db } = await connectToDatabase();
    const collections = getCollections(db);

    // 3. Find service and verify approval + availability
    const service = await collections.services.findOne({ _id: new ObjectId(serviceId) });
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    if (service.approvalStatus !== 'approved' || service.isAvailable !== true) {
      return res.status(400).json({
        success: false,
        message: 'This service is currently unavailable for booking',
      });
    }

    // 4. Block booking own service
    if (
      service.technicianEmail &&
      service.technicianEmail.toLowerCase() === req.user.email.toLowerCase()
    ) {
      return res.status(403).json({
        success: false,
        message: 'You cannot book your own service',
      });
    }

    // 5. Block duplicate active request (requested, accepted, in-progress)
    const activeDuplicate = await collections.bookings.findOne({
      $or: [
        { serviceId: service._id.toString() },
        { serviceId: service._id },
      ],
      customerEmail: { $regex: new RegExp(`^${escapeRegex(req.user.email)}$`, 'i') },
      status: { $in: ['requested', 'accepted', 'in-progress'] },
    });

    if (activeDuplicate) {
      return res.status(409).json({
        success: false,
        message: 'You already have an active request for this service',
      });
    }

    // 6. Construct booking document
    const newBooking = {
      serviceId: service._id.toString(),
      serviceTitle: service.title,
      serviceImage: service.image || '',
      category: service.category,
      basePrice: Number(service.basePrice),
      technicianName: service.technicianName,
      technicianEmail: service.technicianEmail,
      customerName: req.user.name,
      customerEmail: req.user.email,
      customerPhone: contactPhone,
      address: serviceAddress,
      preferredDate: parsedDate,
      problemDescription: description,
      status: 'requested',
      finalAmount: Number(service.basePrice),
      paymentStatus: 'unpaid',
      createdAt: new Date(),
    };

    const insertResult = await collections.bookings.insertOne(newBooking);

    return res.status(201).json({
      success: true,
      message: 'Booking request created successfully',
      booking: {
        ...newBooking,
        _id: insertResult.insertedId,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bookings/my
 * Customer: Fetch all repair bookings created by the logged-in customer.
 * Declared before /:id routes to avoid routing conflicts.
 */
router.get('/my', verifyToken, verifyCustomer, async (req, res, next) => {
  try {
    const { db } = await connectToDatabase();
    const collections = getCollections(db);

    const bookings = await collections.bookings
      .find({
        customerEmail: { $regex: new RegExp(`^${escapeRegex(req.user.email)}$`, 'i') },
      })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(bookings);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bookings/technician?status=
 * Technician: Fetch all bookings assigned to the logged-in technician.
 * Supports optional ?status= query filter.
 * Declared before /:id routes to avoid routing conflicts.
 */
router.get('/technician', verifyToken, verifyTechnician, async (req, res, next) => {
  try {
    const { status } = req.query;
    const { db } = await connectToDatabase();
    const collections = getCollections(db);

    const query = {
      technicianEmail: { $regex: new RegExp(`^${escapeRegex(req.user.email)}$`, 'i') },
    };

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
 * PATCH /api/bookings/:id/cancel
 * Customer: Cancel own booking strictly while in 'requested' status.
 */
router.patch('/:id/cancel', verifyToken, verifyCustomer, async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or invalid ID',
      });
    }

    const { db } = await connectToDatabase();
    const collections = getCollections(db);

    const booking = await collections.bookings.findOne({ _id: new ObjectId(id) });
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Verify ownership
    if (booking.customerEmail.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only cancel your own bookings',
      });
    }

    // Verify current status is strictly 'requested'
    if (booking.status !== 'requested') {
      return res.status(400).json({
        success: false,
        message: 'Only bookings with status "requested" can be cancelled',
      });
    }

    // Atomic update
    const updatedBooking = await collections.bookings.findOneAndUpdate(
      {
        _id: new ObjectId(id),
        customerEmail: booking.customerEmail,
        status: 'requested',
      },
      {
        $set: {
          status: 'cancelled',
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!updatedBooking) {
      return res.status(409).json({
        success: false,
        message: 'Booking status could not be updated or has already changed',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      booking: updatedBooking,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/bookings/:id/status
 * Technician: Update job status pipeline.
 * Rules:
 *  - Must be assigned technician (technicianEmail === req.user.email)
 *  - Transitions:
 *    requested -> accepted | rejected
 *    accepted -> in-progress
 *    in-progress -> completed (requires body.finalAmount > 0)
 *  - Atomic updateOne filtered by _id and current status.
 */
router.patch('/:id/status', verifyToken, verifyTechnician, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status: nextStatus, finalAmount } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or invalid ID',
      });
    }

    if (!nextStatus || typeof nextStatus !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Status is required',
      });
    }

    const { db } = await connectToDatabase();
    const collections = getCollections(db);

    const booking = await collections.bookings.findOne({ _id: new ObjectId(id) });
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Verify ownership
    if (booking.technicianEmail.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only update your own assigned bookings',
      });
    }

    // Validate transition
    const allowedTransitions = VALID_TECHNICIAN_TRANSITIONS[booking.status] || [];
    if (!allowedTransitions.includes(nextStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition status from "${booking.status}" to "${nextStatus}"`,
      });
    }

    // If transitioning to completed, validate finalAmount
    let parsedFinalAmount;
    if (nextStatus === 'completed') {
      parsedFinalAmount = Number(finalAmount);
      if (finalAmount === undefined || finalAmount === null || isNaN(parsedFinalAmount) || parsedFinalAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'finalAmount is required and must be a number greater than 0 when completing a job',
        });
      }
    }

    // Atomic updateOne / findOneAndUpdate filtered by _id, technicianEmail and current status
    const updateFields = {
      status: nextStatus,
      updatedAt: new Date(),
    };

    if (nextStatus === 'completed') {
      updateFields.finalAmount = parsedFinalAmount;
    }

    const updatedBooking = await collections.bookings.findOneAndUpdate(
      {
        _id: new ObjectId(id),
        technicianEmail: booking.technicianEmail,
        status: booking.status,
      },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    if (!updatedBooking) {
      return res.status(409).json({
        success: false,
        message: 'Booking status could not be updated or has already changed',
      });
    }

    res.status(200).json({
      success: true,
      message: `Booking status updated to ${nextStatus}`,
      booking: updatedBooking,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
