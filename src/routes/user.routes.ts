import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { paginate, PaginationRequest } from '../middleware/pagination.middleware';
import { UserService } from '../services/user.service';
import mongoose from 'mongoose';

const router = Router();
const userService = new UserService();

type AuthPaginationRequest = AuthRequest & PaginationRequest;

// GET /users/me — any authenticated user
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await userService.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ data: user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// PUT /users/me — any authenticated user (limited fields)
router.put('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, licenseNumber, licenseExpiry } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (licenseNumber !== undefined) updates.licenseNumber = licenseNumber;
    if (licenseExpiry !== undefined) updates.licenseExpiry = licenseExpiry;

    const user = await userService.update(req.user!.userId, updates, req.user!.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ data: user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET /users — admin only, paginated
router.get(
  '/',
  authenticate,
  requireRole('admin'),
  paginate,
  async (req: AuthPaginationRequest, res: Response) => {
    try {
      const result = await userService.list(req.pagination!, {
        q: req.query.q as string,
        role: req.query.role as string,
        status: req.query.status as string,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
);

// GET /users/:id — admin only
router.get(
  '/:id',
  authenticate,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid user ID' });
        return;
      }
      const user = await userService.findById(id);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json({ data: user });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  }
);

// PUT /users/:id — admin only
router.put(
  '/:id',
  authenticate,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid user ID' });
        return;
      }
      const { name, phone, role, status, licenseNumber, licenseExpiry, availability } = req.body;
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (phone !== undefined) updates.phone = phone;
      if (role !== undefined) updates.role = role;
      if (status !== undefined) updates.status = status;
      if (licenseNumber !== undefined) updates.licenseNumber = licenseNumber;
      if (licenseExpiry !== undefined) updates.licenseExpiry = licenseExpiry;
      if (availability !== undefined) updates.availability = availability;

      const user = await userService.update(id, updates, req.user!.userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json({ data: user });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
);

// DELETE /users/:id — admin only (deactivate)
router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid user ID' });
        return;
      }
      const user = await userService.deactivate(id, req.user!.userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json({ data: user });
    } catch (err) {
      res.status(500).json({ error: 'Failed to deactivate user' });
    }
  }
);

export default router;
