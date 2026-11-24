import { apiClient } from './client';

export interface IngestLocationPayload {
  lat: number;
  lon: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  timestamp?: string;
}

export async function ingestLocation(
  tripId: string,
  payload: IngestLocationPayload,
): Promise<{ locationId: string; timestamp: string }> {
  try {
    const res = await apiClient.post<{ locationId: string; timestamp: string }>(
      `/trips/${tripId}/locations`,
      payload,
    );
    return res.data;
  } catch (error: unknown) {
    console.error('ingestLocation failed:', error);
    throw error;
  }
}
