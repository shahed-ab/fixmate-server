import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { connectToDatabase, getCollections } from '../db.js';
import { verifyToken, verifyTechnician } from '../middlewares/auth.js';

const router = Router();

export const VALID_CATEGORIES = [
  'Smartphone',
  'Laptop & PC',
  'AC',
  'Refrigerator',
  'TV',
  'Washing Machine',
  'Electrical',
];

export const VALID_SERVICE_MODES = [
  'Home Visit',
  'Shop Drop-off',
];

/**
 * Escapes characters with special meaning in RegExp to prevent regex injection.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /api/services
 * Public browsing endpoint: approved + isAvailable only.
 * Supports query parameters:
 *  - q: search keyword matching title or category (regex-escaped)
 *  - category: category filter
 *  - mode: serviceMode filter ('Home Visit' | 'Shop Drop-off')
 *  - sort: 'price-asc' | 'price-desc' | 'newest' | 'oldest'
 *  - page: page number (default 1)
 *  - limit: items per page (default 8)
 * Returns { items, total, page, pages }
 */
router.get('/', async (req, res, next) => {
  try {
    const { db } = await connectToDatabase();
    const collections = getCollections(db);

    const {
      q,
      category,
      mode,
      sort = 'newest',
      page = 1,
      limit = 8,
    } = req.query;

    const query = {
      approvalStatus: 'approved',
      isAvailable: true,
    };

    if (q && q.trim()) {
      const escaped = escapeRegex(q.trim());
      const regex = new RegExp(escaped, 'i');
      query.$or = [
        { title: { $regex: regex } },
        { category: { $regex: regex } },
      ];
    }

    if (category && category.trim().toLowerCase() !== 'all') {
      query.category = { $regex: new RegExp(`^${escapeRegex(category.trim())}$`, 'i') };
    }

    if (mode && mode.trim().toLowerCase() !== 'all') {
      query.serviceMode = { $regex: new RegExp(`^${escapeRegex(mode.trim())}$`, 'i') };
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'price-asc') {
      sortOption = { basePrice: 1 };
    } else if (sort === 'price-desc') {
      sortOption = { basePrice: -1 };
    } else if (sort === 'oldest') {
      sortOption = { createdAt: 1 };
    } else {
      sortOption = { createdAt: -1 };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 8);
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      collections.services
        .find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .toArray(),
      collections.services.countDocuments(query),
    ]);

    const pages = Math.max(1, Math.ceil(total / limitNum));

    res.status(200).json({
      items,
      total,
      page: pageNum,
      pages,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/services/home
 * Public: Returns the latest 6 approved and available services for the home page.
 */
router.get('/home', async (req, res, next) => {
  try {
    const { db } = await connectToDatabase();
    const collections = getCollections(db);

    const items = await collections.services
      .find({
        approvalStatus: 'approved',
        isAvailable: true,
      })
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();

    res.status(200).json(items);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/services/my
 * Technician: Returns services belonging to the logged-in technician.
 * Declared STRICTLY BEFORE /:id to prevent route shadowing.
 */
router.get('/my', verifyToken, verifyTechnician, async (req, res, next) => {
  try {
    const { db } = await connectToDatabase();
    const collections = getCollections(db);

    const items = await collections.services
      .find({ technicianEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(items);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/services/:id
 * Public: Single service details.
 * Returns 404 for invalid ObjectId or not approved / not available.
 * Includes technician summary from the "user" collection.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: 'Service not found or invalid ID',
      });
    }

    const { db } = await connectToDatabase();
    const collections = getCollections(db);

    const service = await collections.services.findOne({
      _id: new ObjectId(id),
      approvalStatus: 'approved',
      isAvailable: true,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found or unavailable',
      });
    }

    let technician = null;
    if (service.technicianEmail) {
      const techUser = await collections.users.findOne({ email: service.technicianEmail });
      if (techUser) {
        technician = {
          id: techUser._id ? techUser._id.toString() : techUser.id,
          name: techUser.name,
          email: techUser.email,
          image: techUser.image || null,
          phone: techUser.phone || null,
          area: techUser.area || null,
          bio: techUser.bio || null,
        };
      }
    }

    res.status(200).json({
      ...service,
      technician,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/services
 * Technician: Create service.
 * Injects technician name/email from req.user.
 * Sets approvalStatus: 'pending', isAvailable: true, createdAt: new Date().
 */
router.post('/', verifyToken, verifyTechnician, async (req, res, next) => {
  try {
    const {
      title,
      category,
      description,
      image,
      basePrice,
      estimatedDuration,
      serviceMode,
      serviceArea,
    } = req.body;

    // Validate required fields
    if (
      !title || typeof title !== 'string' || !title.trim() ||
      !category || typeof category !== 'string' ||
      !description || typeof description !== 'string' || !description.trim() ||
      !image || typeof image !== 'string' || !image.trim() ||
      basePrice === undefined || basePrice === null ||
      !estimatedDuration || typeof estimatedDuration !== 'string' || !estimatedDuration.trim() ||
      !serviceMode || typeof serviceMode !== 'string' ||
      !serviceArea || typeof serviceArea !== 'string' || !serviceArea.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, category, description, image, basePrice, estimatedDuration, serviceMode, serviceArea',
      });
    }

    const numericPrice = Number(basePrice);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'basePrice must be a number greater than 0',
      });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
      });
    }

    if (!VALID_SERVICE_MODES.includes(serviceMode)) {
      return res.status(400).json({
        success: false,
        message: `Invalid serviceMode. Must be one of: ${VALID_SERVICE_MODES.join(', ')}`,
      });
    }

    const { db } = await connectToDatabase();
    const collections = getCollections(db);

    const newService = {
      title: title.trim(),
      category,
      description: description.trim(),
      image: image.trim(),
      basePrice: numericPrice,
      estimatedDuration: estimatedDuration.trim(),
      serviceMode,
      serviceArea: serviceArea.trim(),
      technicianName: req.user.name,
      technicianEmail: req.user.email,
      approvalStatus: 'pending',
      isAvailable: true,
      createdAt: new Date(),
    };

    const insertResult = await collections.services.insertOne(newService);

    res.status(201).json({
      success: true,
      message: 'Service created successfully and submitted for admin approval',
      service: {
        _id: insertResult.insertedId,
        ...newService,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/services/:id/availability
 * Technician (owner only): Toggle availability boolean.
 * Must NOT reset approvalStatus.
 */
router.patch('/:id/availability', verifyToken, verifyTechnician, async (req, res, next) => {
  try {
    const { id } = req.params;
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

    if (service.technicianEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not own this service',
      });
    }

    const newAvailability = req.body.isAvailable !== undefined
      ? Boolean(req.body.isAvailable)
      : !service.isAvailable;

    await collections.services.updateOne(
      { _id: new ObjectId(id) },
      { $set: { isAvailable: newAvailability } }
    );

    const updatedService = await collections.services.findOne({ _id: new ObjectId(id) });

    res.status(200).json({
      success: true,
      message: 'Service availability updated',
      isAvailable: newAvailability,
      service: updatedService,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/services/:id
 * Technician (owner only): Update own service.
 * Resets approvalStatus to 'pending'.
 */
router.patch('/:id', verifyToken, verifyTechnician, async (req, res, next) => {
  try {
    const { id } = req.params;
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

    if (service.technicianEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not own this service',
      });
    }

    const updates = {};
    const {
      title,
      category,
      description,
      image,
      basePrice,
      estimatedDuration,
      serviceMode,
      serviceArea,
    } = req.body;

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ success: false, message: 'title cannot be empty' });
      }
      updates.title = title.trim();
    }

    if (category !== undefined) {
      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({
          success: false,
          message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
        });
      }
      updates.category = category;
    }

    if (description !== undefined) {
      if (typeof description !== 'string' || !description.trim()) {
        return res.status(400).json({ success: false, message: 'description cannot be empty' });
      }
      updates.description = description.trim();
    }

    if (image !== undefined) {
      if (typeof image !== 'string' || !image.trim()) {
        return res.status(400).json({ success: false, message: 'image cannot be empty' });
      }
      updates.image = image.trim();
    }

    if (basePrice !== undefined) {
      const numericPrice = Number(basePrice);
      if (isNaN(numericPrice) || numericPrice <= 0) {
        return res.status(400).json({
          success: false,
          message: 'basePrice must be a number greater than 0',
        });
      }
      updates.basePrice = numericPrice;
    }

    if (estimatedDuration !== undefined) {
      if (typeof estimatedDuration !== 'string' || !estimatedDuration.trim()) {
        return res.status(400).json({ success: false, message: 'estimatedDuration cannot be empty' });
      }
      updates.estimatedDuration = estimatedDuration.trim();
    }

    if (serviceMode !== undefined) {
      if (!VALID_SERVICE_MODES.includes(serviceMode)) {
        return res.status(400).json({
          success: false,
          message: `Invalid serviceMode. Must be one of: ${VALID_SERVICE_MODES.join(', ')}`,
        });
      }
      updates.serviceMode = serviceMode;
    }

    if (serviceArea !== undefined) {
      if (typeof serviceArea !== 'string' || !serviceArea.trim()) {
        return res.status(400).json({ success: false, message: 'serviceArea cannot be empty' });
      }
      updates.serviceArea = serviceArea.trim();
    }

    // Always reset approvalStatus to 'pending' upon service edit
    updates.approvalStatus = 'pending';
    updates.updatedAt = new Date();

    await collections.services.updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    const updatedService = await collections.services.findOne({ _id: new ObjectId(id) });

    res.status(200).json({
      success: true,
      message: 'Service updated and returned to pending approval',
      service: updatedService,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/services/:id
 * Technician (owner only): Delete own service.
 */
router.delete('/:id', verifyToken, verifyTechnician, async (req, res, next) => {
  try {
    const { id } = req.params;
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

    if (service.technicianEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not own this service',
      });
    }

    await collections.services.deleteOne({ _id: new ObjectId(id) });

    res.status(200).json({
      success: true,
      message: 'Service deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
