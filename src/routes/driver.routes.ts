import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { paginate, PaginationRequest } from '../middleware/pagination.middleware';
import { DriverService } from '../services/driver.service';
import mongoose from 'mongoose';

const router = Router();
const driverService = new DriverService();

type AuthPaginationRequest = AuthRequest & PaginationRequest;

// GET /drivers/available — admin/fleet_manager
router.get(
  '/available',
  authenticate,
  requireRole('admin', 'fleet_manager'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const drivers = await driverService.getAvailableDrivers();
      res.json({ data: drivers });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch available drivers' });
    }
  }
);

// GET /drivers/me/stats — driver's own stats
router.get(
  '/me/stats',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const stats = await driverService.getStats(req.user!.userId);
      res.json({ data: stats });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch driver stats' });
    }
  }
);

// PATCH /drivers/me/availability — driver only
router.patch(
  '/me/availability',
  authenticate,
  requireRole('driver'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { availability } = req.body;
      if (!['on_duty', 'off_duty'].includes(availability)) {
        res.status(400).json({ error: 'Invalid availability value' });
        return;
      }
      const user = await driverService.updateAvailability(req.user!.userId, availability);
      if (!user) {
        res.status(404).json({ error: 'Driver not found' });
        return;
      }
      res.json({ data: user });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update availability' });
    }
  }
);

// GET /drivers/:id/trips — admin/fleet_manager
router.get(
  '/:id/trips',
  authenticate,
  requireRole('admin', 'fleet_manager'),
  paginate,
  async (req: AuthPaginationRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid driver ID' });
        return;
      }
      const result = await driverService.getTripHistory(id, req.pagination!);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch driver trips' });
    }
  }
);

// GET /drivers/:id/stats — admin/fleet_manager
router.get(
  '/:id/stats',
  authenticate,
  requireRole('admin', 'fleet_manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid driver ID' });
        return;
      }
      const stats = await driverService.getStats(id);
      res.json({ data: stats });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch driver stats' });
    }
  }
);

export default router;
