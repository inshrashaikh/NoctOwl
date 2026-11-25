import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmergencyContact, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const MAX_EMERGENCY_CONTACTS = 5;

const USER_PROFILE_SELECT = {
  id: true,
  phone: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  profile: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_PROFILE_SELECT,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.getProfile(userId);

    const hasProfileFields =
      dto.avatarUrl !== undefined || dto.settings !== undefined;

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(hasProfileFields
          ? {
              profile: {
                upsert: {
                  create: {
                    ...(dto.avatarUrl !== undefined
                      ? { avatarUrl: dto.avatarUrl }
                      : {}),
                    ...(dto.settings !== undefined
                      ? { settings: dto.settings }
                      : {}),
                  },
                  update: {
                    ...(dto.avatarUrl !== undefined
                      ? { avatarUrl: dto.avatarUrl }
                      : {}),
                    ...(dto.settings !== undefined
                      ? { settings: dto.settings }
                      : {}),
                  },
                },
              },
            }
          : {}),
      },
      select: USER_PROFILE_SELECT,
    });
  }

  async createContact(userId: string, dto: CreateContactDto) {
    const existingCount = await this.prisma.emergencyContact.count({
      where: { userId },
    });

    if (existingCount >= MAX_EMERGENCY_CONTACTS) {
      throw new BadRequestException(
        `Maximum of ${MAX_EMERGENCY_CONTACTS} emergency contacts allowed`,
      );
    }

    return this.prisma.emergencyContact.create({
      data: {
        userId,
        name: dto.name,
        phone: dto.phone,
        relation: dto.relation,
        priority: dto.priority ?? 1,
        ...(dto.fcmToken !== undefined ? { fcmToken: dto.fcmToken } : {}),
      },
    });
  }

  async listContacts(userId: string) {
    return this.prisma.emergencyContact.findMany({
      where: { userId },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async updateContact(
    userId: string,
    contactId: string,
    dto: UpdateContactDto,
  ) {
    await this.findOwnedContact(userId, contactId);

    return this.prisma.emergencyContact.update({
      where: { id: contactId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.relation !== undefined ? { relation: dto.relation } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.fcmToken !== undefined ? { fcmToken: dto.fcmToken } : {}),
      },
    });
  }

  async deleteContact(userId: string, contactId: string) {
    await this.findOwnedContact(userId, contactId);

    return this.prisma.emergencyContact.delete({
      where: { id: contactId },
    });
  }

  private async findOwnedContact(
    userId: string,
    contactId: string,
  ): Promise<EmergencyContact> {
    const contact = await this.prisma.emergencyContact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      throw new NotFoundException('Emergency contact not found');
    }

    if (contact.userId !== userId) {
      throw new ForbiddenException('You do not own this emergency contact');
    }

    return contact;
  }
}

export { UsersService as ProfileService };
