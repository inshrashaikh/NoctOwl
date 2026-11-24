import { SafeZoneItem } from '../store/tripStore';
import { apiClient } from './client';

export interface GeofenceCheckItem {
  inside: boolean;
  zoneId: string;
  zoneName: string;
  event?: 'ENTER' | 'EXIT';
}

export async function listSafeZones(): Promise<SafeZoneItem[]> {
  try {
    const res = await apiClient.get<SafeZoneItem[]>('/safe-zones');
    return res.data;
  } catch (error: unknown) {
    console.error('listSafeZones failed:', error);
    throw error;
  }
}

export async function checkGeofence(
  tripId: string,
  lat: number,
  lon: number,
): Promise<GeofenceCheckItem[]> {
  try {
    const res = await apiClient.post<GeofenceCheckItem[]>(
      `/trips/${tripId}/geofence-check`,
      { lat, lon },
    );
    return res.data;
  } catch (error: unknown) {
    console.error('checkGeofence failed:', error);
    throw error;
  }
}
