import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { DashboardService } from '../services/dashboard.service';

const router = Router();
const dashboardService = new DashboardService();

// GET /dashboard/stats — admin/fleet_manager
router.get(
  '/stats',
  authenticate,
  requireRole('admin', 'fleet_manager'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const stats = await dashboardService.getStats();
      res.json({ data: stats });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  }
);

// GET /dashboard/fleet-map — admin/fleet_manager
router.get(
  '/fleet-map',
  authenticate,
  requireRole('admin', 'fleet_manager'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const vehicles = await dashboardService.getFleetMap();
      res.json({ data: vehicles });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch fleet map' });
    }
  }
);

export default router;
