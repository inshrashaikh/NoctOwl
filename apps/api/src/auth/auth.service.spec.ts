import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
  };
  let redis: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  };
  let jwtService: {
    signAsync: jest.Mock;
    verifyAsync: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
    getOrThrow: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    redis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
        return undefined;
      }),
      getOrThrow: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return 'test-access-secret';
        throw new Error(`Missing env ${key}`);
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('requestOtp', () => {
    it('generates a 6-digit OTP, stores it in Redis with 300s TTL, and returns only requestId', async () => {
      const result = await service.requestOtp('+911234567890');

      expect(result).toHaveProperty('requestId');
      expect(typeof result.requestId).toBe('string');
      expect((result as Record<string, unknown>).otp).toBeUndefined();

      expect(redis.set).toHaveBeenCalledTimes(1);
      const [key, payload, ttl] = redis.set.mock.calls[0] as [
        string,
        string,
        number,
      ];
      expect(key).toBe('otp:+911234567890');
      expect(ttl).toBe(300);

      const parsed = JSON.parse(payload) as { otp: string; requestId: string };
      expect(parsed.otp).toMatch(/^\d{6}$/);
      expect(parsed.requestId).toBe(result.requestId);
    });
  });

  describe('verifyOtp', () => {
    it('throws UnauthorizedException when OTP is missing or expired', async () => {
      redis.get.mockResolvedValue(null);

      await expect(
        service.verifyOtp('+911234567890', '123456'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when stored Redis payload is malformed JSON', async () => {
      redis.get.mockResolvedValue('not-json');

      await expect(
        service.verifyOtp('+911234567890', '123456'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when OTP does not match', async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({ otp: '654321', requestId: 'req-1' }),
      );

      await expect(
        service.verifyOtp('+911234567890', '123456'),
      ).rejects.toThrow(UnauthorizedException);
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when OTP length differs', async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({ otp: '654321', requestId: 'req-1' }),
      );

      await expect(
        service.verifyOtp('+911234567890', '123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('creates a new user + profile and returns tokens when user does not exist', async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({ otp: '123456', requestId: 'req-1' }),
      );
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        phone: '+911234567890',
        role: Role.USER,
      });
      jwtService.signAsync
        .mockResolvedValueOnce('access-token-1')
        .mockResolvedValueOnce('refresh-token-1');

      const result = await service.verifyOtp('+911234567890', '123456');

      expect(redis.del).toHaveBeenCalledWith('otp:+911234567890');
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          phone: '+911234567890',
          profile: { create: {} },
        },
      });
      expect(result).toEqual({
        accessToken: 'access-token-1',
        refreshToken: 'refresh-token-1',
        userId: 'user-1',
      });
      expect(redis.set).toHaveBeenCalledWith(
        'refresh:user-1',
        expect.any(String),
        7 * 24 * 60 * 60,
      );
    });

    it('falls back to JWT_SECRET when JWT_REFRESH_SECRET is not configured', async () => {
      configService.get.mockReturnValue(undefined);
      redis.get.mockResolvedValue(
        JSON.stringify({ otp: '123456', requestId: 'req-1' }),
      );
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-fallback',
        phone: '+911234567890',
        role: Role.USER,
      });
      jwtService.signAsync
        .mockResolvedValueOnce('access-fb')
        .mockResolvedValueOnce('refresh-fb');

      await service.verifyOtp('+911234567890', '123456');

      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ sub: 'user-fallback', role: Role.USER }),
        { secret: 'test-access-secret', expiresIn: '7d' },
      );
    });

    it('reuses an existing user and issues tokens', async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({ otp: '123456', requestId: 'req-1' }),
      );
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-existing',
        phone: '+911234567890',
        role: Role.ADMIN,
      });
      jwtService.signAsync
        .mockResolvedValueOnce('access-token-2')
        .mockResolvedValueOnce('refresh-token-2');

      const result = await service.verifyOtp('+911234567890', '123456');

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(result.userId).toBe('user-existing');
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        1,
        { sub: 'user-existing', role: Role.ADMIN },
        { secret: 'test-access-secret', expiresIn: '15m' },
      );
    });

    it('rejects deactivated users with UnauthorizedException', async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({ otp: '123456', requestId: 'req-1' }),
      );
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-deactivated',
        phone: '+911234567890',
        role: Role.USER,
        active: false,
      });

      await expect(
        service.verifyOtp('+911234567890', '123456'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('throws UnauthorizedException if JWT verification fails', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'));

      await expect(service.refreshToken('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException if no refresh token hash is stored in Redis', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', role: Role.USER });
      redis.get.mockResolvedValue(null);

      await expect(service.refreshToken('some-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException if refresh token hash does not match', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', role: Role.USER });
      const wrongHash = await bcrypt.hash('different-digest', 10);
      redis.get.mockResolvedValue(wrongHash);

      await expect(service.refreshToken('some-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException if user no longer exists', async () => {
      const token = 'valid-refresh-token';
      const digest = crypto.createHash('sha256').update(token).digest('hex');
      const storedHash = await bcrypt.hash(digest, 10);

      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', role: Role.USER });
      redis.get.mockResolvedValue(storedHash);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken(token)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rotates and returns new tokens when refresh token is valid', async () => {
      const token = 'valid-refresh-token';
      const digest = crypto.createHash('sha256').update(token).digest('hex');
      const storedHash = await bcrypt.hash(digest, 10);

      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', role: Role.USER });
      redis.get.mockResolvedValue(storedHash);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: Role.USER,
      });
      jwtService.signAsync
        .mockResolvedValueOnce('new-access')
        .mockResolvedValueOnce('new-refresh');

      const result = await service.refreshToken(token);

      expect(result).toEqual({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });
      expect(redis.set).toHaveBeenCalledWith(
        'refresh:user-1',
        expect.any(String),
        7 * 24 * 60 * 60,
      );
    });
  });

  describe('logout', () => {
    it('deletes the stored refresh token from Redis', async () => {
      const result = await service.logout('user-1');

      expect(redis.del).toHaveBeenCalledWith('refresh:user-1');
      expect(result).toEqual({ success: true });
    });
  });
});
