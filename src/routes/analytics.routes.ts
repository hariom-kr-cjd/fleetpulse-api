import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { AnalyticsService } from '../services/analytics.service';

const router = Router();
const analyticsService = new AnalyticsService();

// GET /analytics/trips — admin/fleet_manager
router.get(
  '/trips',
  authenticate,
  requireRole('admin', 'fleet_manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const period = (req.query.period as 'day' | 'week' | 'month') || 'month';
      const data = await analyticsService.getTripsSummary(period);
      res.json({ data });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch trip analytics' });
    }
  }
);

// GET /analytics/drivers — admin/fleet_manager
router.get(
  '/drivers',
  authenticate,
  requireRole('admin', 'fleet_manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const data = await analyticsService.getDriverPerformance(limit);
      res.json({ data });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch driver analytics' });
    }
  }
);

// GET /analytics/vehicles — admin/fleet_manager
router.get(
  '/vehicles',
  authenticate,
  requireRole('admin', 'fleet_manager'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const data = await analyticsService.getVehicleUtilization();
      res.json({ data });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch vehicle analytics' });
    }
  }
);

export default router;
