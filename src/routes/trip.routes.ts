import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { paginate, PaginationRequest } from '../middleware/pagination.middleware';
import { TripService } from '../services/trip.service';
import mongoose from 'mongoose';

const router = Router();
const tripService = new TripService();

type AuthPaginationRequest = AuthRequest & PaginationRequest;

// GET /trips/my — driver's own trips
router.get(
  '/my',
  authenticate,
  paginate,
  async (req: AuthPaginationRequest, res: Response) => {
    try {
      const result = await tripService.getMyTrips(req.user!.userId, req.pagination!);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch trips' });
    }
  }
);

// GET /trips — admin/fleet_manager, paginated, filterable
router.get(
  '/',
  authenticate,
  requireRole('admin', 'fleet_manager'),
  paginate,
  async (req: AuthPaginationRequest, res: Response) => {
    try {
      const result = await tripService.list(req.pagination!, {
        status: req.query.status as string,
        driverId: req.query.driverId as string,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch trips' });
    }
  }
);

// GET /trips/:id
router.get(
  '/:id',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid trip ID' });
        return;
      }
      const trip = await tripService.findById(id);
      if (!trip) {
        res.status(404).json({ error: 'Trip not found' });
        return;
      }
      res.json({ data: trip });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch trip' });
    }
  }
);

// GET /trips/:id/timeline
router.get(
  '/:id/timeline',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid trip ID' });
        return;
      }
      const timeline = await tripService.getTimeline(id);
      res.json({ data: timeline });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch timeline' });
    }
  }
);

// POST /trips — admin/fleet_manager
router.post(
  '/',
  authenticate,
  requireRole('admin', 'fleet_manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const trip = await tripService.create(req.body, req.user!.userId);
      res.status(201).json({ data: trip });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create trip';
      res.status(400).json({ error: message });
    }
  }
);

// PATCH /trips/:id/start — driver (assigned only)
router.patch(
  '/:id/start',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid trip ID' });
        return;
      }
      const trip = await tripService.start(id, req.user!.userId);
      if (!trip) {
        res.status(404).json({ error: 'Trip not found or not assigned to you' });
        return;
      }
      res.json({ data: trip });
    } catch (err) {
      res.status(500).json({ error: 'Failed to start trip' });
    }
  }
);

// PATCH /trips/:id/checkpoint/:index — driver (assigned only)
router.patch(
  '/:id/checkpoint/:index',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const index = parseInt(req.params.index as string, 10);
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid trip ID' });
        return;
      }
      const trip = await tripService.arriveCheckpoint(id, index, req.user!.userId);
      if (!trip) {
        res.status(404).json({ error: 'Trip not found or not assigned to you' });
        return;
      }
      res.json({ data: trip });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update checkpoint';
      res.status(400).json({ error: message });
    }
  }
);

// PATCH /trips/:id/complete — driver (assigned only)
router.patch(
  '/:id/complete',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid trip ID' });
        return;
      }
      const trip = await tripService.complete(id, req.user!.userId);
      if (!trip) {
        res.status(404).json({ error: 'Trip not found or not assigned to you' });
        return;
      }
      res.json({ data: trip });
    } catch (err) {
      res.status(500).json({ error: 'Failed to complete trip' });
    }
  }
);

// PATCH /trips/:id/cancel — admin/fleet_manager
router.patch(
  '/:id/cancel',
  authenticate,
  requireRole('admin', 'fleet_manager'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid trip ID' });
        return;
      }
      const trip = await tripService.cancel(id, req.user!.userId);
      if (!trip) {
        res.status(404).json({ error: 'Trip not found or already completed' });
        return;
      }
      res.json({ data: trip });
    } catch (err) {
      res.status(500).json({ error: 'Failed to cancel trip' });
    }
  }
);

export default router;
