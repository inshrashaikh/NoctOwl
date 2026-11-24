import {
  MapLocationPoint,
  SafeZoneItem,
  TripStatus,
  TripSummary,
} from '../store/tripStore';
import { apiClient } from './client';

export interface TripTrailResponse {
  locations: MapLocationPoint[];
  route?: unknown;
}

export interface TripMarkersResponse {
  start: { lat: number; lon: number } | null;
  end: { lat: number; lon: number } | null;
  latestLocation: MapLocationPoint | null;
  safeZones: SafeZoneItem[];
}

export async function listTrips(): Promise<TripSummary[]> {
  try {
    const res = await apiClient.get<TripSummary[]>('/trips');
    return res.data;
  } catch (error: unknown) {
    console.error('listTrips failed:', error);
    throw error;
  }
}

export async function createTrip(input: {
  title?: string;
  startLat?: number;
  startLon?: number;
  endLat?: number;
  endLon?: number;
}): Promise<TripSummary> {
  try {
    const res = await apiClient.post<TripSummary>('/trips', input);
    return res.data;
  } catch (error: unknown) {
    console.error('createTrip failed:', error);
    throw error;
  }
}

export async function getTrip(tripId: string): Promise<TripSummary> {
  try {
    const res = await apiClient.get<TripSummary>(`/trips/${tripId}`);
    return res.data;
  } catch (error: unknown) {
    console.error('getTrip failed:', error);
    throw error;
  }
}

export async function updateTripStatus(
  tripId: string,
  status: TripStatus,
): Promise<TripSummary> {
  try {
    const res = await apiClient.patch<TripSummary>(`/trips/${tripId}/status`, {
      status,
    });
    return res.data;
  } catch (error: unknown) {
    console.error('updateTripStatus failed:', error);
    throw error;
  }
}

export async function triggerEmergency(
  tripId?: string,
  metadata?: Record<string, unknown>,
): Promise<{ notificationId: string; status: string }> {
  try {
    const res = await apiClient.post<{ notificationId: string; status: string }>(
      '/emergency/trigger',
      { tripId, metadata },
    );
    return res.data;
  } catch (error: unknown) {
    console.error('triggerEmergency failed:', error);
    throw error;
  }
}

export async function getTripTrail(tripId: string): Promise<TripTrailResponse> {
  try {
    const res = await apiClient.get<TripTrailResponse>(
      `/trips/${tripId}/map/trail`,
    );
    return res.data;
  } catch (error: unknown) {
    console.error('getTripTrail failed:', error);
    throw error;
  }
}

export async function getTripMarkers(
  tripId: string,
): Promise<TripMarkersResponse> {
  try {
    const res = await apiClient.get<TripMarkersResponse>(
      `/trips/${tripId}/map/markers`,
    );
    return res.data;
  } catch (error: unknown) {
    console.error('getTripMarkers failed:', error);
    throw error;
  }
}
