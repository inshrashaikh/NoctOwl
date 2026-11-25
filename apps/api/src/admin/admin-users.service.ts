import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

const ADMIN_USER_SELECT = {
  id: true,
  phone: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listUsers(query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.search
        ? {
            OR: [
              { phone: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: ADMIN_USER_SELECT,
        orderBy: { createdAt: query.sortOrder ?? 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...ADMIN_USER_SELECT,
        profile: true,
        contacts: {
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        },
        trips: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateUserRole(adminId: string, userId: string, role: Role) {
    if (adminId === userId && role !== Role.ADMIN) {
      throw new BadRequestException('Admins cannot demote themselves');
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: ADMIN_USER_SELECT,
    });

    this.logger.log(
      `Admin ${adminId} updated role of user ${userId} to ${role}`,
    );

    return updated;
  }

  async deactivateUser(adminId: string, userId: string) {
    if (adminId === userId) {
      throw new BadRequestException('Admins cannot deactivate themselves');
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { active: false },
      select: ADMIN_USER_SELECT,
    });

    this.logger.log(`Admin ${adminId} deactivated user ${userId}`);
    return updated;
  }
}
