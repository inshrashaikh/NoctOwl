import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    emergencyContact: {
      count: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      emergencyContact: {
        count: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  describe('getProfile', () => {
    it('returns the user and profile when found', async () => {
      const user = {
        id: 'user-1',
        phone: '+911234567890',
        name: 'Asha',
        email: 'asha@noctowl.app',
        role: Role.USER,
        profile: { id: 'prof-1', avatarUrl: null, settings: null },
      };
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getProfile('user-1');
      expect(result).toEqual(user);
    });

    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('updates user and upserts profile fields', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        name: 'Asha R',
        email: 'asha@noctowl.app',
        profile: {
          avatarUrl: 'https://cdn.noctowl.app/a.png',
          settings: { darkMode: true },
        },
      });

      const result = await service.updateProfile('user-1', {
        name: 'Asha R',
        email: 'asha@noctowl.app',
        avatarUrl: 'https://cdn.noctowl.app/a.png',
        settings: { darkMode: true },
      });

      expect(result.name).toBe('Asha R');
      expect(prisma.user.update).toHaveBeenCalledTimes(1);
    });

    it('updates only user fields when no profile fields are provided', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.user.update.mockResolvedValue({ id: 'user-1', name: 'Only Name' });

      await service.updateProfile('user-1', { name: 'Only Name' });

      const callArg = prisma.user.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(callArg.data.profile).toBeUndefined();
      expect(callArg.data.name).toBe('Only Name');
    });

    it('updates only profile fields when user fields are omitted', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        profile: { avatarUrl: 'https://cdn.noctowl.app/b.png' },
      });

      await service.updateProfile('user-1', {
        avatarUrl: 'https://cdn.noctowl.app/b.png',
      });

      const callArg = prisma.user.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(callArg.data.name).toBeUndefined();
      expect(callArg.data.email).toBeUndefined();
      expect(callArg.data.profile).toBeDefined();
    });
  });

  describe('createContact', () => {
    it('creates a contact when under the 5-contact limit', async () => {
      prisma.emergencyContact.count.mockResolvedValue(4);
      prisma.emergencyContact.create.mockResolvedValue({
        id: 'contact-5',
        userId: 'user-1',
        name: 'Mom',
        phone: '+919999999999',
        relation: 'family',
        priority: 1,
      });

      const result = await service.createContact('user-1', {
        name: 'Mom',
        phone: '+919999999999',
        relation: 'family',
      });

      expect(result.id).toBe('contact-5');
      expect(prisma.emergencyContact.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          name: 'Mom',
          phone: '+919999999999',
          relation: 'family',
          priority: 1,
        },
      });
    });

    it('throws BadRequestException when user already has 5 contacts', async () => {
      prisma.emergencyContact.count.mockResolvedValue(5);

      await expect(
        service.createContact('user-1', {
          name: 'Extra',
          phone: '+918888888888',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.emergencyContact.create).not.toHaveBeenCalled();
    });
  });

  describe('listContacts', () => {
    it('lists contacts ordered by priority ascending', async () => {
      const contacts = [
        { id: 'c1', priority: 1 },
        { id: 'c2', priority: 2 },
      ];
      prisma.emergencyContact.findMany.mockResolvedValue(contacts);

      const result = await service.listContacts('user-1');

      expect(result).toEqual(contacts);
      expect(prisma.emergencyContact.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      });
    });
  });

  describe('updateContact & deleteContact ownership', () => {
    it('throws NotFoundException when contact does not exist', async () => {
      prisma.emergencyContact.findUnique.mockResolvedValue(null);

      await expect(
        service.updateContact('user-1', 'c-missing', { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when updating another user contact', async () => {
      prisma.emergencyContact.findUnique.mockResolvedValue({
        id: 'c1',
        userId: 'user-other',
      });

      await expect(
        service.updateContact('user-1', 'c1', { name: 'Hacked' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.emergencyContact.update).not.toHaveBeenCalled();
    });

    it('updates contact when owned by user', async () => {
      prisma.emergencyContact.findUnique.mockResolvedValue({
        id: 'c1',
        userId: 'user-1',
      });
      prisma.emergencyContact.update.mockResolvedValue({
        id: 'c1',
        userId: 'user-1',
        name: 'Updated',
        priority: 2,
      });

      const result = await service.updateContact('user-1', 'c1', {
        name: 'Updated',
        phone: '+919111111111',
        relation: 'friend',
        priority: 2,
      });

      expect(result.name).toBe('Updated');
      expect(result.priority).toBe(2);
    });

    it('updates contact with empty partial payload', async () => {
      prisma.emergencyContact.findUnique.mockResolvedValue({
        id: 'c1',
        userId: 'user-1',
      });
      prisma.emergencyContact.update.mockResolvedValue({ id: 'c1' });

      await service.updateContact('user-1', 'c1', {});
      expect(prisma.emergencyContact.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: {},
      });
    });

    it('throws ForbiddenException when deleting another user contact', async () => {
      prisma.emergencyContact.findUnique.mockResolvedValue({
        id: 'c1',
        userId: 'user-other',
      });

      await expect(service.deleteContact('user-1', 'c1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.emergencyContact.delete).not.toHaveBeenCalled();
    });

    it('deletes contact when owned by user', async () => {
      prisma.emergencyContact.findUnique.mockResolvedValue({
        id: 'c1',
        userId: 'user-1',
      });
      prisma.emergencyContact.delete.mockResolvedValue({ id: 'c1' });

      const result = await service.deleteContact('user-1', 'c1');
      expect(result).toEqual({ id: 'c1' });
    });
  });
});
