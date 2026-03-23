import { Request, Response, NextFunction } from 'express';

export interface PaginationRequest extends Request {
  pagination?: {
    page: number;
    limit: number;
    skip: number;
    sort: string;
  };
}

export function paginate(req: PaginationRequest, _res: Response, next: NextFunction): void {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const sort = (req.query.sort as string) || '-createdAt';

  req.pagination = { page, limit, skip: (page - 1) * limit, sort };
  next();
}
