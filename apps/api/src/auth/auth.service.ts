import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const OTP_TTL_SECONDS = 300;
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
const BCRYPT_COST = 10;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async requestOtp(phone: string): Promise<{ requestId: string }> {
    const otp = crypto.randomInt(100000, 1000000).toString();
    const requestId = crypto.randomUUID();

    await this.redis.set(
      this.otpKey(phone),
      JSON.stringify({ otp, requestId }),
      OTP_TTL_SECONDS,
    );

    return { requestId };
  }

  async verifyOtp(
    phone: string,
    otp: string,
  ): Promise<TokenPair & { userId: string }> {
    const raw = await this.redis.get(this.otpKey(phone));
    if (!raw) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    let parsed: { otp?: string };
    try {
      parsed = JSON.parse(raw) as { otp?: string };
    } catch {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    if (!parsed.otp || !this.safeEqual(parsed.otp, otp)) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    await this.redis.del(this.otpKey(phone));

    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone,
          profile: { create: {} },
        },
      });
    } else if (user.active === false) {
      throw new UnauthorizedException('User account is deactivated');
    }

    const tokens = await this.issueAndStoreTokens(user.id, user.role);
    return {
      ...tokens,
      userId: user.id,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    let payload: { sub: string; role: Role };
    try {
      payload = await this.jwtService.verifyAsync<{ sub: string; role: Role }>(
        refreshToken,
        { secret: this.getRefreshSecret() },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const storedHash = await this.redis.get(this.refreshKey(payload.sub));
    if (!storedHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const matches = await bcrypt.compare(
      this.digestToken(refreshToken),
      storedHash,
    );
    if (!matches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    if (user.active === false) {
      throw new UnauthorizedException('User account is deactivated');
    }

    return this.issueAndStoreTokens(user.id, user.role);
  }

  async logout(userId: string): Promise<{ success: boolean }> {
    await this.redis.del(this.refreshKey(userId));
    return { success: true };
  }

  private async issueAndStoreTokens(
    userId: string,
    role: Role,
  ): Promise<TokenPair> {
    const accessSecret = this.configService.getOrThrow<string>('JWT_SECRET');
    const refreshSecret = this.getRefreshSecret();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, role },
        { secret: accessSecret, expiresIn: '15m' },
      ),
      this.jwtService.signAsync(
        { sub: userId, role, jti: crypto.randomUUID() },
        { secret: refreshSecret, expiresIn: '7d' },
      ),
    ]);

    const refreshHash = await bcrypt.hash(
      this.digestToken(refreshToken),
      BCRYPT_COST,
    );
    await this.redis.set(
      this.refreshKey(userId),
      refreshHash,
      REFRESH_TTL_SECONDS,
    );

    return { accessToken, refreshToken };
  }

  private getRefreshSecret(): string {
    return (
      this.configService.get<string>('JWT_REFRESH_SECRET') ??
      this.configService.getOrThrow<string>('JWT_SECRET')
    );
  }

  /**
   * SHA-256 pre-hash keeps input under bcrypt's 72-byte truncation limit.
   */
  private digestToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  }

  private otpKey(phone: string): string {
    return `otp:${phone}`;
  }

  private refreshKey(userId: string): string {
    return `refresh:${userId}`;
  }
}
