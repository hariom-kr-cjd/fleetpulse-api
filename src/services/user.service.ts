import { User, IUser } from '../models/user.model';
import { AuditService } from './audit.service';

interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  sort: string;
}

interface UserListQuery {
  q?: string;
  role?: string;
  status?: string;
}

interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export class UserService {
  private auditService = new AuditService();

  async list(
    pagination: PaginationParams,
    query: UserListQuery
  ): Promise<PaginatedResult<IUser>> {
    const filter: Record<string, unknown> = {};

    if (query.q) {
      const regex = new RegExp(query.q, 'i');
      filter.$or = [{ name: regex }, { email: regex }];
    }

    if (query.role) {
      filter.role = query.role;
    }

    if (query.status) {
      filter.status = query.status;
    }

    const [data, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort(pagination.sort)
        .skip(pagination.skip)
        .limit(pagination.limit),
      User.countDocuments(filter),
    ]);

    return {
      data,
      meta: {
        total,
        page: pagination.page,
        limit: pagination.limit,
        pages: Math.ceil(total / pagination.limit),
      },
    };
  }

  async findById(id: string): Promise<IUser | null> {
    return User.findById(id).select('-password');
  }

  async update(
    id: string,
    updates: Partial<Pick<IUser, 'name' | 'phone' | 'role' | 'status' | 'licenseNumber' | 'licenseExpiry' | 'availability'>>,
    performedBy: string
  ): Promise<IUser | null> {
    const user = await User.findByIdAndUpdate(id, updates, {
      returnDocument: 'after',
      runValidators: true,
    }).select('-password');

    if (user) {
      await this.auditService.log({
        userId: performedBy,
        action: 'user_updated',
        resource: 'User',
        resourceId: String(user._id),
        details: updates,
      });
    }

    return user;
  }

  async deactivate(id: string, performedBy: string): Promise<IUser | null> {
    const user = await User.findByIdAndUpdate(
      id,
      { status: 'inactive' },
      { returnDocument: 'after' }
    ).select('-password');

    if (user) {
      await this.auditService.log({
        userId: performedBy,
        action: 'user_deactivated',
        resource: 'User',
        resourceId: String(user._id),
      });
    }

    return user;
  }
}
