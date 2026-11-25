import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from './ai.service';

describe('AiService', () => {
  let service: AiService;
  let http: { post: jest.Mock };
  let configService: { get: jest.Mock };
  let prisma: {
    trip: { findUnique: jest.Mock };
    riskAssessment: { create: jest.Mock };
  };

  beforeEach(async () => {
    http = { post: jest.fn() };
    configService = { get: jest.fn().mockReturnValue(undefined) };
    prisma = {
      trip: { findUnique: jest.fn() },
      riskAssessment: { create: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: HttpService, useValue: http },
        { provide: ConfigService, useValue: configService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(AiService);
  });

  describe('assessRisk', () => {
    it('posts snake_case payload to AI_SERVICE_URL and maps response to camelCase', async () => {
      configService.get.mockReturnValue('http://localhost:8000');
      http.post.mockReturnValue(
        of({
          data: {
            risk_score: 0.65,
            factors: [{ name: 'nighttime', contribution: 0.15 }],
          },
        }),
      );

      const result = await service.assessRisk({
        lat: 12.9716,
        lon: 77.5946,
        timestamp: '2026-11-24T02:00:00Z',
        speedKmh: 60,
        heading: 180,
        roadType: 'rural',
        isNight: true,
      });

      expect(http.post).toHaveBeenCalledWith(
        'http://localhost:8000/risk/assess',
        {
          lat: 12.9716,
          lon: 77.5946,
          timestamp: '2026-11-24T02:00:00Z',
          speed_kmh: 60,
          heading: 180,
          road_type: 'rural',
          is_night: true,
        },
        { timeout: 5000 },
      );
      expect(result).toEqual({
        riskScore: 0.65,
        factors: [{ name: 'nighttime', contribution: 0.15 }],
      });
    });

    it('falls back to default http://ai-service:8000 and throws ServiceUnavailableException on HTTP error', async () => {
      http.post.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));

      await expect(
        service.assessRisk({
          lat: 12.9716,
          lon: 77.5946,
          timestamp: '2026-11-24T02:00:00Z',
          isNight: true,
        }),
      ).rejects.toThrow(ServiceUnavailableException);

      expect(http.post).toHaveBeenCalledWith(
        'http://ai-service:8000/risk/assess',
        expect.objectContaining({ is_night: true }),
        { timeout: 5000 },
      );
    });
  });

  describe('assessTripRisk', () => {
    it('throws NotFoundException when trip does not exist', async () => {
      prisma.trip.findUnique.mockResolvedValue(null);

      await expect(
        service.assessTripRisk('trip-1', 'user-1', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when trip belongs to another user', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        userId: 'other-user',
      });

      await expect(
        service.assessTripRisk('trip-1', 'user-1', {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when neither DTO nor trip has coordinates', async () => {
      prisma.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        userId: 'user-1',
        startLat: null,
        startLon: null,
      });

      await expect(
        service.assessTripRisk('trip-1', 'user-1', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('calls assessRisk using trip start coords fallback and persists RiskAssessment', async () => {
      const assessedAt = new Date();
      prisma.trip.findUnique.mockResolvedValue({
        id: 'trip-1',
        userId: 'user-1',
        startLat: 12.9716,
        startLon: 77.5946,
      });
      http.post.mockReturnValue(
        of({
          data: {
            risk_score: 0.5,
            factors: [{ name: 'baseline', contribution: 0.2 }],
          },
        }),
      );
      prisma.riskAssessment.create.mockResolvedValue({
        id: 'ra-1',
        tripId: 'trip-1',
        riskScore: 0.5,
        factors: [{ name: 'baseline', contribution: 0.2 }],
        assessedAt,
      });

      const result = await service.assessTripRisk('trip-1', 'user-1', {
        segmentId: 'seg-1',
      });

      expect(prisma.riskAssessment.create).toHaveBeenCalledWith({
        data: {
          tripId: 'trip-1',
          segmentId: 'seg-1',
          riskScore: 0.5,
          factors: [{ name: 'baseline', contribution: 0.2 }],
        },
      });
      expect(result).toEqual({
        riskScore: 0.5,
        factors: [{ name: 'baseline', contribution: 0.2 }],
        assessedAt,
      });
    });
  });
});
