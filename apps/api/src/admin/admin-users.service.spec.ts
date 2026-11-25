import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminUsersService } from './admin-users.service';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let prisma: {
    user: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(AdminUsersService);
  });

  it('lists paginated users with search and role filter', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'u1', role: Role.USER }]);
    prisma.user.count.mockResolvedValue(25);

    const res = await service.listUsers({
      page: 2,
      limit: 10,
      search: '9112',
      role: Role.USER,
      sortOrder: 'asc',
    });

    expect(res).toEqual({
      items: [{ id: 'u1', role: Role.USER }],
      total: 25,
      page: 2,
      limit: 10,
      totalPages: 3,
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        orderBy: { createdAt: 'asc' },
      }),
    );
    const resDefault = await service.listUsers({});
    expect(resDefault.page).toBe(1);
    expect(resDefault.limit).toBe(20);
  });

  it('returns user detail or throws NotFoundException if missing', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.getUserDetail('missing')).rejects.toThrow(
      NotFoundException,
    );

    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'u1',
      contacts: [],
      trips: [],
    });
    expect((await service.getUserDetail('u1')).id).toBe('u1');
  });

  it('prevents admin self-demotion and updates other user role', async () => {
    await expect(
      service.updateUserRole('admin-1', 'admin-1', Role.USER),
    ).rejects.toThrow(BadRequestException);

    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.updateUserRole('admin-1', 'u-missing', Role.ADMIN),
    ).rejects.toThrow(NotFoundException);

    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' });
    prisma.user.update.mockResolvedValue({ id: 'u1', role: Role.ADMIN });

    const updated = await service.updateUserRole('admin-1', 'u1', Role.ADMIN);
    expect(updated.role).toBe(Role.ADMIN);
  });

  it('prevents self-deactivation and soft-deactivates other user', async () => {
    await expect(service.deactivateUser('admin-1', 'admin-1')).rejects.toThrow(
      BadRequestException,
    );

    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.deactivateUser('admin-1', 'u-missing'),
    ).rejects.toThrow(NotFoundException);

    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' });
    prisma.user.update.mockResolvedValue({ id: 'u1', active: false });

    const deactivated = await service.deactivateUser('admin-1', 'u1');
    expect(deactivated.active).toBe(false);
  });
});
