import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { paginate, PaginationRequest } from '../middleware/pagination.middleware';
import { AuditLog } from '../models/audit-log.model';

const router = Router();

type AuthPaginationRequest = AuthRequest & PaginationRequest;

// GET /audit-logs — admin only, paginated
router.get(
  '/',
  authenticate,
  requireRole('admin'),
  paginate,
  async (req: AuthPaginationRequest, res: Response) => {
    try {
      const filter: Record<string, unknown> = {};
      if (req.query.action) filter.action = req.query.action;
      if (req.query.resource) filter.resource = req.query.resource;

      const [data, total] = await Promise.all([
        AuditLog.find(filter)
          .populate('userId', 'name email')
          .sort(req.pagination!.sort)
          .skip(req.pagination!.skip)
          .limit(req.pagination!.limit),
        AuditLog.countDocuments(filter),
      ]);

      res.json({
        data,
        meta: {
          total,
          page: req.pagination!.page,
          limit: req.pagination!.limit,
          pages: Math.ceil(total / req.pagination!.limit),
        },
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  }
);

export default router;
