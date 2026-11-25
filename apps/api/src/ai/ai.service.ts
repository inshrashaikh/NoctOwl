import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AssessRiskDto } from './dto/assess-risk.dto';

export interface RiskFactorItem {
  name: string;
  contribution: number;
}

export interface AssessRiskParams {
  lat: number;
  lon: number;
  timestamp: string;
  speedKmh?: number;
  heading?: number;
  roadType?: string;
  isNight: boolean;
}

export interface AssessRiskResult {
  riskScore: number;
  factors: RiskFactorItem[];
}

export interface TripRiskAssessmentResult extends AssessRiskResult {
  assessedAt: Date;
}

interface PythonRiskApiResponse {
  risk_score: number;
  factors: RiskFactorItem[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly http: HttpService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async assessRisk(params: AssessRiskParams): Promise<AssessRiskResult> {
    const baseUrl =
      this.configService.get<string>('AI_SERVICE_URL') ||
      'http://ai-service:8000';
    const url = `${baseUrl}/risk/assess`;

    const payload = {
      lat: params.lat,
      lon: params.lon,
      timestamp: params.timestamp,
      ...(params.speedKmh !== undefined ? { speed_kmh: params.speedKmh } : {}),
      ...(params.heading !== undefined ? { heading: params.heading } : {}),
      ...(params.roadType !== undefined ? { road_type: params.roadType } : {}),
      is_night: params.isNight,
    };

    try {
      const response = await firstValueFrom(
        this.http.post<PythonRiskApiResponse>(url, payload, { timeout: 5000 }),
      );

      return {
        riskScore: response.data.risk_score,
        factors: response.data.factors ?? [],
      };
    } catch (error: unknown) {
      this.logger.error(
        `AI risk assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new ServiceUnavailableException(
        'AI risk scoring service is unavailable',
      );
    }
  }

  async assessTripRisk(
    tripId: string,
    userId: string,
    dto: AssessRiskDto,
  ): Promise<TripRiskAssessmentResult> {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    if (trip.userId !== userId) {
      this.logger.warn(
        `Unauthorized risk assessment attempt by user=${userId} for trip=${tripId}`,
      );
      throw new ForbiddenException('You do not have access to this trip');
    }

    const lat = dto.lat ?? trip.startLat;
    const lon = dto.lon ?? trip.startLon;

    if (lat === null || lat === undefined || lon === null || lon === undefined) {
      throw new BadRequestException(
        'Coordinates (lat, lon) are required to assess trip risk',
      );
    }

    const assessment = await this.assessRisk({
      lat,
      lon,
      timestamp: dto.timestamp ?? new Date().toISOString(),
      speedKmh: dto.speedKmh,
      heading: dto.heading,
      roadType: dto.roadType,
      isNight: dto.isNight ?? true,
    });

    const saved = await this.prisma.riskAssessment.create({
      data: {
        tripId,
        segmentId: dto.segmentId,
        riskScore: assessment.riskScore,
        factors: assessment.factors as unknown as Prisma.InputJsonValue,
      },
    });

    this.logger.log(
      `Saved RiskAssessment ${saved.id} (score=${saved.riskScore}) for trip=${tripId}`,
    );

    return {
      riskScore: saved.riskScore,
      factors: assessment.factors,
      assessedAt: saved.assessedAt,
    };
  }
}
