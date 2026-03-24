import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { paginate, PaginationRequest } from '../middleware/pagination.middleware';
import { VehicleService } from '../services/vehicle.service';
import mongoose from 'mongoose';

const router = Router();
const vehicleService = new VehicleService();

type AuthPaginationRequest = AuthRequest & PaginationRequest;

// GET /vehicles — admin/fleet_manager
router.get(
  '/',
  authenticate,
  requireRole('admin', 'fleet_manager'),
  paginate,
  async (req: AuthPaginationRequest, res: Response) => {
    try {
      const result = await vehicleService.list(req.pagination!, {
        status: req.query.status as string,
        type: req.query.type as string,
        q: req.query.q as string,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch vehicles' });
    }
  }
);

// GET /vehicles/upcoming-maintenance — admin/fleet_manager
router.get(
  '/upcoming-maintenance',
  authenticate,
  requireRole('admin', 'fleet_manager'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const data = await vehicleService.getUpcomingMaintenance();
      res.json({ data });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch upcoming maintenance' });
    }
  }
);

// GET /vehicles/:id — admin/fleet_manager
router.get(
  '/:id',
  authenticate,
  requireRole('admin', 'fleet_manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid vehicle ID' });
        return;
      }
      const vehicle = await vehicleService.findById(id);
      if (!vehicle) {
        res.status(404).json({ error: 'Vehicle not found' });
        return;
      }
      res.json({ data: vehicle });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch vehicle' });
    }
  }
);

// POST /vehicles — admin/fleet_manager
router.post(
  '/',
  authenticate,
  requireRole('admin', 'fleet_manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const vehicle = await vehicleService.create(req.body, req.user!.userId);
      res.status(201).json({ data: vehicle });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create vehicle';
      const status = message.includes('duplicate') || message.includes('E11000') ? 409 : 500;
      res.status(status).json({ error: message });
    }
  }
);

// PUT /vehicles/:id — admin/fleet_manager
router.put(
  '/:id',
  authenticate,
  requireRole('admin', 'fleet_manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid vehicle ID' });
        return;
      }
      const vehicle = await vehicleService.update(id, req.body, req.user!.userId);
      if (!vehicle) {
        res.status(404).json({ error: 'Vehicle not found' });
        return;
      }
      res.json({ data: vehicle });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update vehicle' });
    }
  }
);

// PATCH /vehicles/:id/location — driver (ownership check)
router.patch(
  '/:id/location',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid vehicle ID' });
        return;
      }
      const { lat, lng } = req.body;
      if (lat === undefined || lng === undefined) {
        res.status(400).json({ error: 'lat and lng are required' });
        return;
      }
      const vehicle = await vehicleService.updateLocation(id, lat, lng, req.user!.userId);
      if (!vehicle) {
        res.status(404).json({ error: 'Vehicle not found' });
        return;
      }
      res.json({ data: vehicle });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update location';
      if (message === 'Not assigned to this vehicle') {
        res.status(403).json({ error: message });
        return;
      }
      res.status(500).json({ error: message });
    }
  }
);

// PATCH /vehicles/:id/status — admin/fleet_manager
router.patch(
  '/:id/status',
  authenticate,
  requireRole('admin', 'fleet_manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid vehicle ID' });
        return;
      }
      const { status } = req.body;
      if (!['active', 'idle', 'maintenance'].includes(status)) {
        res.status(400).json({ error: 'Invalid status' });
        return;
      }
      const vehicle = await vehicleService.update(id, { status }, req.user!.userId);
      if (!vehicle) {
        res.status(404).json({ error: 'Vehicle not found' });
        return;
      }
      res.json({ data: vehicle });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update vehicle status' });
    }
  }
);

// POST /vehicles/:id/maintenance — admin/fleet_manager
router.post(
  '/:id/maintenance',
  authenticate,
  requireRole('admin', 'fleet_manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid vehicle ID' });
        return;
      }
      const existing = await vehicleService.findById(id);
      if (!existing) {
        res.status(404).json({ error: 'Vehicle not found' });
        return;
      }
      const log = await vehicleService.addMaintenanceLog(id, req.body, req.user!.userId);
      res.status(201).json({ data: log });
    } catch (err) {
      res.status(500).json({ error: 'Failed to add maintenance log' });
    }
  }
);

// GET /vehicles/:id/maintenance — admin/fleet_manager
router.get(
  '/:id/maintenance',
  authenticate,
  requireRole('admin', 'fleet_manager'),
  paginate,
  async (req: AuthPaginationRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid vehicle ID' });
        return;
      }
      const result = await vehicleService.getMaintenanceHistory(id, req.pagination!);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch maintenance history' });
    }
  }
);

export default router;
