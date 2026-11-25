import { ArgumentsHost, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Prisma, Role } from '@prisma/client';
import { AdminAnalyticsController } from './admin/admin-analytics.controller';
import { AdminAnalyticsService } from './admin/admin-analytics.service';
import { AdminTripsController } from './admin/admin-trips.controller';
import { AdminTripsService } from './admin/admin-trips.service';
import { AdminUsersController } from './admin/admin-users.controller';
import { AdminUsersService } from './admin/admin-users.service';
import { AiController } from './ai/ai.controller';
import { AiService } from './ai/ai.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtStrategy } from './auth/strategies/jwt.strategy';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { RolesGuard } from './common/guards/roles.guard';
import { GeofencingController } from './geofencing/geofencing.controller';
import { GeofencingService } from './geofencing/geofencing.service';
import { HealthController } from './health/health.controller';
import { MapsController } from './maps/maps.controller';
import { MapsService } from './maps/maps.service';
import { NotificationService } from './notifications/notification.service';
import { NotificationsController } from './notifications/notifications.controller';
import { RoutingController } from './routing/routing.controller';
import { RoutingService } from './routing/routing.service';
import { SyncActionType } from './sync/dto/sync-batch.dto';
import { SyncController } from './sync/sync.controller';
import { SyncService } from './sync/sync.service';
import { TrackingController } from './tracking/tracking.controller';
import { TrackingService } from './tracking/tracking.service';
import { TripsController } from './trips/trips.controller';
import { TripsService } from './trips/trips.service';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';

describe('Controllers, Guards & Strategy Unit Tests', () => {
  describe('HealthController', () => {
    it('returns ok status', () => {
      const controller = new HealthController();
      expect(controller.check()).toEqual({ status: 'ok' });
    });
  });

  describe('JwtStrategy', () => {
    it('validates JWT payload into AuthenticatedUser', () => {
      const configService = {
        getOrThrow: jest.fn().mockReturnValue('secret'),
      } as unknown as ConfigService;
      const strategy = new JwtStrategy(configService);

      expect(strategy.validate({ sub: 'u1', role: Role.USER })).toEqual({
        userId: 'u1',
        role: Role.USER,
      });
    });
  });

  describe('RolesGuard', () => {
    const makeContext = (user?: { userId: string; role: Role }) =>
      ({
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: () => ({
          getRequest: () => ({ user }),
        }),
      }) as unknown as ExecutionContext;

    it('allows access when no roles metadata is defined', () => {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue(undefined),
      } as unknown as Reflector;
      const guard = new RolesGuard(reflector);

      expect(guard.canActivate(makeContext())).toBe(true);
    });

    it('denies access when user is missing on request', () => {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue([Role.ADMIN]),
      } as unknown as Reflector;
      const guard = new RolesGuard(reflector);

      expect(guard.canActivate(makeContext(undefined))).toBe(false);
    });

    it('allows access when user role matches required role', () => {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue([Role.ADMIN]),
      } as unknown as Reflector;
      const guard = new RolesGuard(reflector);

      expect(
        guard.canActivate(makeContext({ userId: 'u1', role: Role.ADMIN })),
      ).toBe(true);
      expect(
        guard.canActivate(makeContext({ userId: 'u2', role: Role.USER })),
      ).toBe(false);
    });
  });

  describe('AuthController', () => {
    it('delegates auth endpoints to AuthService', async () => {
      const authService = {
        requestOtp: jest.fn().mockResolvedValue({ requestId: 'r1' }),
        verifyOtp: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r', userId: 'u1' }),
        refreshToken: jest.fn().mockResolvedValue({ accessToken: 'a2', refreshToken: 'r2' }),
        logout: jest.fn().mockResolvedValue({ success: true }),
      } as unknown as AuthService;

      const controller = new AuthController(authService);
      expect(await controller.requestOtp({ phone: '+911234567890' })).toEqual({ requestId: 'r1' });
      expect(await controller.verifyOtp({ phone: '+911234567890', otp: '123456' })).toHaveProperty('accessToken');
      expect(await controller.refresh({ refreshToken: 'r' })).toHaveProperty('accessToken');
      expect(await controller.logout({ userId: 'u1', role: Role.USER })).toEqual({ success: true });
    });
  });

  describe('UsersController', () => {
    it('delegates profile and contacts endpoints to UsersService', async () => {
      const usersService = {
        getProfile: jest.fn().mockResolvedValue({ id: 'u1' }),
        updateProfile: jest.fn().mockResolvedValue({ id: 'u1', name: 'New' }),
        listContacts: jest.fn().mockResolvedValue([]),
        createContact: jest.fn().mockResolvedValue({ id: 'c1' }),
        updateContact: jest.fn().mockResolvedValue({ id: 'c1' }),
        deleteContact: jest.fn().mockResolvedValue({ id: 'c1' }),
      } as unknown as UsersService;

      const controller = new UsersController(usersService);
      const user = { userId: 'u1', role: Role.USER };
      expect(await controller.getProfile(user)).toEqual({ id: 'u1' });
      expect(await controller.updateProfile(user, { name: 'New' })).toEqual({ id: 'u1', name: 'New' });
      expect(await controller.listContacts(user)).toEqual([]);
      expect(await controller.createContact(user, { name: 'Mom', phone: '+911234567890' })).toEqual({ id: 'c1' });
      expect(await controller.updateContact(user, 'c1', { name: 'Dad' })).toEqual({ id: 'c1' });
      expect(await controller.deleteContact(user, 'c1')).toEqual({ id: 'c1' });
    });
  });

  describe('TripsController', () => {
    it('delegates trip endpoints to TripsService', async () => {
      const tripsService = {
        createTrip: jest.fn().mockResolvedValue({ id: 't1' }),
        listTrips: jest.fn().mockResolvedValue([]),
        getTrip: jest.fn().mockResolvedValue({ id: 't1' }),
        updateTripStatus: jest.fn().mockResolvedValue({ id: 't1', status: 'ACTIVE' }),
      } as unknown as TripsService;

      const controller = new TripsController(tripsService);
      const user = { userId: 'u1', role: Role.USER };
      expect(await controller.createTrip(user, { title: 'Ride' })).toEqual({ id: 't1' });
      expect(await controller.listTrips(user)).toEqual([]);
      expect(await controller.getTrip(user, 't1')).toEqual({ id: 't1' });
      expect(await controller.updateTripStatus(user, 't1', { status: 'ACTIVE' as never })).toEqual({
        id: 't1',
        status: 'ACTIVE',
      });
    });
  });

  describe('PrismaExceptionFilter', () => {
    const makeHost = () => {
      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      const host = {
        switchToHttp: () => ({
          getResponse: () => ({ status }),
        }),
      } as unknown as ArgumentsHost;
      return { host, status, json };
    };

    it('maps P2002 to 409 Conflict', () => {
      const filter = new PrismaExceptionFilter();
      const { host, status, json } = makeHost();
      const error = new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: '7.10.1',
        meta: { target: ['userId', 'phone'] },
      });

      filter.catch(error, host);
      expect(status).toHaveBeenCalledWith(409);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 409, error: 'Conflict' }),
      );
    });

    it('maps P2025 to 404 Not Found', () => {
      const filter = new PrismaExceptionFilter();
      const { host, status } = makeHost();
      const error = new Prisma.PrismaClientKnownRequestError('Missing', {
        code: 'P2025',
        clientVersion: '7.10.1',
      });

      filter.catch(error, host);
      expect(status).toHaveBeenCalledWith(404);
    });

    it('maps P2003 to 400 Bad Request', () => {
      const filter = new PrismaExceptionFilter();
      const { host, status } = makeHost();
      const error = new Prisma.PrismaClientKnownRequestError('FK fail', {
        code: 'P2003',
        clientVersion: '7.10.1',
      });

      filter.catch(error, host);
      expect(status).toHaveBeenCalledWith(400);
    });

    it('maps other Prisma codes to 500 Internal Server Error', () => {
      const filter = new PrismaExceptionFilter();
      const { host, status } = makeHost();
      const error = new Prisma.PrismaClientKnownRequestError('Other', {
        code: 'P2010',
        clientVersion: '7.10.1',
      });

      filter.catch(error, host);
      expect(status).toHaveBeenCalledWith(500);
    });
  });

  describe('TrackingController', () => {
    it('delegates ingestLocation and getRecentLocations to TrackingService', async () => {
      const trackingService = {
        ingestLocation: jest.fn().mockResolvedValue({ locationId: 'l1' }),
        getRecentLocations: jest.fn().mockResolvedValue([{ id: 'l1' }]),
      } as unknown as TrackingService;

      const controller = new TrackingController(trackingService);
      const user = { userId: 'u1', role: Role.USER };
      expect(
        await controller.ingestLocation(user, 'trip-1', { lat: 12.9, lon: 77.5 }),
      ).toEqual({ locationId: 'l1' });
      expect(
        await controller.getRecentLocations(user, 'trip-1', { limit: 10 }),
      ).toEqual([{ id: 'l1' }]);
    });
  });

  describe('RoutingController', () => {
    it('delegates calculateRoute and getEta to RoutingService', async () => {
      const routingService = {
        calculateRoute: jest.fn().mockResolvedValue({ tripId: 'trip-1' }),
        getEta: jest.fn().mockResolvedValue({ distanceKm: 5, etaMinutes: 10 }),
      } as unknown as RoutingService;

      const controller = new RoutingController(routingService);
      const user = { userId: 'u1', role: Role.USER };
      expect(await controller.calculateRoute(user, 'trip-1')).toEqual({
        tripId: 'trip-1',
      });
      expect(await controller.getEta(user, 'trip-1')).toEqual({
        distanceKm: 5,
        etaMinutes: 10,
      });
    });
  });

  describe('AiController', () => {
    it('delegates assessTripRisk to AiService', async () => {
      const aiService = {
        assessTripRisk: jest.fn().mockResolvedValue({ riskScore: 0.4 }),
      } as unknown as AiService;

      const controller = new AiController(aiService);
      const user = { userId: 'u1', role: Role.USER };
      expect(await controller.assessTripRisk(user, 'trip-1', {})).toEqual({
        riskScore: 0.4,
      });
    });
  });

  describe('NotificationsController', () => {
    it('delegates triggerEmergency and getStatus to NotificationService', async () => {
      const notificationService = {
        triggerEmergency: jest.fn().mockResolvedValue({ notificationId: 'n1' }),
        getNotificationStatus: jest
          .fn()
          .mockResolvedValue({ notificationId: 'n1', status: 'DELIVERED' }),
      } as unknown as NotificationService;

      const controller = new NotificationsController(notificationService);
      const user = { userId: 'u1', role: Role.USER };
      expect(await controller.triggerEmergency(user, {})).toEqual({
        notificationId: 'n1',
      });
      expect(await controller.getStatus(user, 'n1')).toEqual({
        notificationId: 'n1',
        status: 'DELIVERED',
      });
    });
  });

  describe('GeofencingController', () => {
    it('delegates safe-zone and geofence endpoints to GeofencingService', async () => {
      const geofencingService = {
        createSafeZone: jest.fn().mockResolvedValue({ id: 'z1' }),
        listSafeZones: jest.fn().mockResolvedValue([{ id: 'z1' }]),
        updateSafeZone: jest.fn().mockResolvedValue({ id: 'z1', name: 'New' }),
        deleteSafeZone: jest.fn().mockResolvedValue({ id: 'z1' }),
        checkGeofence: jest.fn().mockResolvedValue([{ inside: true }]),
        listGeofenceEvents: jest.fn().mockResolvedValue([]),
      } as unknown as GeofencingService;

      const controller = new GeofencingController(geofencingService);
      const user = { userId: 'u1', role: Role.USER };
      expect(await controller.createSafeZone(user, { name: 'Home' })).toEqual({ id: 'z1' });
      expect(await controller.listSafeZones(user)).toEqual([{ id: 'z1' }]);
      expect(await controller.updateSafeZone(user, 'z1', { name: 'New' })).toEqual({ id: 'z1', name: 'New' });
      expect(await controller.deleteSafeZone(user, 'z1')).toEqual({ id: 'z1' });
      expect(await controller.checkGeofence(user, 't1', { lat: 12.9, lon: 77.5 })).toEqual([{ inside: true }]);
      expect(await controller.listGeofenceEvents(user, 't1')).toEqual([]);
    });
  });

  describe('MapsController', () => {
    it('delegates trail and markers endpoints to MapsService', async () => {
      const mapsService = {
        getTripTrail: jest.fn().mockResolvedValue({ locations: [] }),
        getTripMarkers: jest.fn().mockResolvedValue({ safeZones: [] }),
      } as unknown as MapsService;

      const controller = new MapsController(mapsService);
      const user = { userId: 'u1', role: Role.USER };
      expect(await controller.getTripTrail(user, 't1')).toEqual({ locations: [] });
      expect(await controller.getTripMarkers(user, 't1')).toEqual({ safeZones: [] });
    });
  });

  describe('SyncController', () => {
    it('delegates processBatch to SyncService', async () => {
      const syncService = {
        processBatch: jest.fn().mockResolvedValue({ processed: 1, skipped: 0, errors: [] }),
      } as unknown as SyncService;

      const controller = new SyncController(syncService);
      const user = { userId: 'u1', role: Role.USER };
      expect(
        await controller.processBatch(user, {
          actions: [
            {
              clientId: 'c1',
              type: SyncActionType.LOCATION,
              payload: {},
              occurredAt: new Date().toISOString(),
            },
          ],
        }),
      ).toEqual({ processed: 1, skipped: 0, errors: [] });
    });
  });

  describe('Admin Controllers', () => {
    it('delegates AdminUsersController, AdminTripsController, and AdminAnalyticsController', async () => {
      const usersSvc = {
        listUsers: jest.fn().mockResolvedValue({ items: [] }),
        getUserDetail: jest.fn().mockResolvedValue({ id: 'u1' }),
        updateUserRole: jest.fn().mockResolvedValue({ id: 'u1', role: Role.ADMIN }),
        deactivateUser: jest.fn().mockResolvedValue({ id: 'u1', active: false }),
      } as unknown as AdminUsersService;
      const tripsSvc = {
        listTrips: jest.fn().mockResolvedValue({ items: [] }),
        getTripDetail: jest.fn().mockResolvedValue({ id: 't1' }),
        forceEndTrip: jest.fn().mockResolvedValue({ id: 't1', status: 'CANCELLED' }),
      } as unknown as AdminTripsService;
      const analyticsSvc = {
        getOverview: jest.fn().mockResolvedValue({ totalUsers: 1 }),
        getTripStats: jest.fn().mockResolvedValue({ totalTrips: 1 }),
        getRiskDistribution: jest.fn().mockResolvedValue([]),
        getNotificationDeliveryStats: jest.fn().mockResolvedValue({ total: 0 }),
        exportTripsCsv: jest.fn().mockResolvedValue('userId,phone'),
      } as unknown as AdminAnalyticsService;

      const admin = { userId: 'admin-1', role: Role.ADMIN };
      const usersCtrl = new AdminUsersController(usersSvc);
      expect(await usersCtrl.listUsers({})).toEqual({ items: [] });
      expect(await usersCtrl.getUserDetail('u1')).toEqual({ id: 'u1' });
      expect(await usersCtrl.updateUserRole(admin, 'u1', { role: Role.ADMIN })).toEqual({ id: 'u1', role: Role.ADMIN });
      expect(await usersCtrl.deactivateUser(admin, 'u1')).toEqual({ id: 'u1', active: false });

      const tripsCtrl = new AdminTripsController(tripsSvc);
      expect(await tripsCtrl.listTrips({})).toEqual({ items: [] });
      expect(await tripsCtrl.getTripDetail('t1')).toEqual({ id: 't1' });
      expect(await tripsCtrl.forceEndTrip(admin, 't1')).toEqual({ id: 't1', status: 'CANCELLED' });

      const analyticsCtrl = new AdminAnalyticsController(analyticsSvc);
      expect(await analyticsCtrl.getOverview({})).toEqual({ totalUsers: 1 });
      expect(await analyticsCtrl.getTripStats({})).toEqual({ totalTrips: 1 });
      expect(await analyticsCtrl.getRiskDistribution({})).toEqual([]);
      expect(await analyticsCtrl.getNotificationDeliveryStats({})).toEqual({ total: 0 });
      expect(await analyticsCtrl.exportTripsCsv({})).toBe('userId,phone');
    });
  });
});
