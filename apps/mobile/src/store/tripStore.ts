import { create } from 'zustand';

export type TripStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface TripSummary {
  id: string;
  title: string | null;
  status: TripStatus;
  startTime: string | null;
  endTime: string | null;
  startLat: number | null;
  startLon: number | null;
  endLat: number | null;
  endLon: number | null;
  createdAt: string;
}

export interface MapLocationPoint {
  lat: number;
  lon: number;
  speed?: number | null;
  heading?: number | null;
  timestamp: string;
}

export interface SafeZoneItem {
  id: string;
  name: string;
  geometry: {
    type: string;
    coordinates: number[][][];
  };
  radius: number | null;
  centerLat: number | null;
  centerLon: number | null;
  color: string;
  active: boolean;
}

export interface GeofenceBroadcastEvent {
  zoneId: string;
  zoneName: string;
  eventType: 'ENTER' | 'EXIT';
  lat: number;
  lon: number;
  occurredAt: string;
}

export interface TripState {
  trips: TripSummary[];
  activeTrip: TripSummary | null;
  latestLocation: MapLocationPoint | null;
  trail: MapLocationPoint[];
  safeZones: SafeZoneItem[];
  lastGeofenceEvent: GeofenceBroadcastEvent | null;
  isTracking: boolean;
  setTrips: (trips: TripSummary[]) => void;
  setActiveTrip: (trip: TripSummary | null) => void;
  setLatestLocation: (loc: MapLocationPoint) => void;
  setTrail: (trail: MapLocationPoint[]) => void;
  setSafeZones: (zones: SafeZoneItem[]) => void;
  setLastGeofenceEvent: (event: GeofenceBroadcastEvent | null) => void;
  setIsTracking: (isTracking: boolean) => void;
}

export const useTripStore = create<TripState>((set) => ({
  trips: [],
  activeTrip: null,
  latestLocation: null,
  trail: [],
  safeZones: [],
  lastGeofenceEvent: null,
  isTracking: false,

  setTrips: (trips) => set({ trips }),
  setActiveTrip: (activeTrip) => set({ activeTrip }),
  setLatestLocation: (latestLocation) =>
    set((state) => ({
      latestLocation,
      trail: [...state.trail, latestLocation],
    })),
  setTrail: (trail) => set({ trail }),
  setSafeZones: (safeZones) => set({ safeZones }),
  setLastGeofenceEvent: (lastGeofenceEvent) => set({ lastGeofenceEvent }),
  setIsTracking: (isTracking) => set({ isTracking }),
}));
