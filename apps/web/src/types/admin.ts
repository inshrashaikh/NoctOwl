export type Role = "USER" | "ADMIN";
export type TripStatus = "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
export type DeliveryStatus =
  | "PENDING"
  | "SENT"
  | "DELIVERED"
  | "FAILED"
  | "ACKNOWLEDGED";

export interface AuthVerifyResponse {
  accessToken: string;
  refreshToken: string;
  userId: string;
}

export interface AuthRequestOtpResponse {
  requestId?: string;
  message?: string;
  otp?: string;
}

export interface CurrentUser {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  role: Role;
  active?: boolean;
}

export interface AdminUser {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  role: Role;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmergencyContactItem {
  id: string;
  name: string;
  phone: string;
  relationship: string | null;
  priority: number;
}

export interface UserProfileItem {
  id: string;
  avatarUrl: string | null;
  settings: Record<string, unknown> | null;
}

export interface AdminTripSummary {
  id: string;
  userId: string;
  status: TripStatus;
  originAddress: string | null;
  destAddress: string | null;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  startTime: string | null;
  endTime: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserDetail extends AdminUser {
  profile: UserProfileItem | null;
  contacts: EmergencyContactItem[];
  trips: AdminTripSummary[];
}

export interface AdminTrip extends AdminTripSummary {
  user: {
    id: string;
    phone: string;
    name: string | null;
  };
}

export interface TripLocationItem {
  id: string;
  lat: number;
  lng: number;
  speed: number | null;
  accuracy: number | null;
  timestamp: string;
}

export interface RiskAssessmentItem {
  id: string;
  riskScore: number;
  riskLevel: string;
  factors: Record<string, unknown> | null;
  assessedAt: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  status: DeliveryStatus;
  failureReason: string | null;
  createdAt: string;
}

export interface GeofenceEventItem {
  id: string;
  eventType: string;
  occurredAt: string;
  safeZone: {
    id: string;
    name: string;
  } | null;
}

export interface AdminTripDetail extends AdminTripSummary {
  user: {
    id: string;
    phone: string;
    name: string | null;
    email: string | null;
  };
  locations: TripLocationItem[];
  riskAssessments: RiskAssessmentItem[];
  notifications: NotificationItem[];
  geofenceEvents: GeofenceEventItem[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListUsersFilters {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role | "";
  sortOrder?: "asc" | "desc";
}

export interface ListTripsFilters {
  page?: number;
  limit?: number;
  status?: TripStatus | "";
  userId?: string;
  from?: string;
  to?: string;
}

export interface DateRangeFilters {
  from?: string;
  to?: string;
}

export interface AnalyticsOverview {
  totalUsers: number;
  activeTripsToday: number;
  notifications: {
    total: number;
    sent: number;
    delivered: number;
    failed: number;
  };
  avgRiskScore: number;
}

export interface TripStatsResponse {
  totalTrips: number;
  byStatus: Record<TripStatus, number>;
  tripsPerDay: Array<{ date: string; count: number }>;
  avgDurationMinutes: number;
}

export interface RiskBucketItem {
  bucket: string;
  count: number;
}

export interface NotificationDeliveryStatsResponse {
  total: number;
  pending: number;
  sent: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
  failureReasons: Array<{ reason: string; count: number }>;
}
