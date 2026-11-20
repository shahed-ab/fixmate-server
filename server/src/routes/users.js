import { Router } from 'express';
import { connectToDatabase, getCollections } from '../db.js';
import { verifyToken } from '../middlewares/auth.js';

const router = Router();

/**
 * PATCH /api/users/profile
 * Authenticated user profile update.
 * Allows updating name, phone, area, bio, and image only.
 * Strictly forbids updating role or email.
 */
router.patch('/profile', verifyToken, async (req, res, next) => {
  try {
    const { name, phone, area, bio, image } = req.body;
    const updates = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Name cannot be empty',
        });
      }
      updates.name = name.trim();
    }

    if (phone !== undefined) {
      updates.phone = typeof phone === 'string' ? phone.trim() : '';
    }

    if (area !== undefined) {
      updates.area = typeof area === 'string' ? area.trim() : '';
    }

    if (bio !== undefined) {
      updates.bio = typeof bio === 'string' ? bio.trim() : '';
    }

    if (image !== undefined) {
      updates.image = typeof image === 'string' ? image.trim() : '';
    }

    // Role and email are strictly immutable via profile updates
    // Even if passed in request body, they are excluded

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid profile update fields provided (allowed: name, phone, area, bio, image)',
      });
    }

    updates.updatedAt = new Date();

    const { db } = await connectToDatabase();
    const collections = getCollections(db);

    await collections.users.updateOne(
      { email: req.user.email },
      { $set: updates }
    );

    const updatedUser = await collections.users.findOne(
      { email: req.user.email },
      { projection: { password: 0 } }
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
