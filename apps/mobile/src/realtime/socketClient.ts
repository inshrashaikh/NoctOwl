import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../api/client';
import {
  GeofenceBroadcastEvent,
  MapLocationPoint,
  useTripStore,
} from '../store/tripStore';

class TrackingSocketClient {
  private socket: Socket | null = null;

  connect(token: string): void {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(`${API_BASE_URL}/tracking`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
    });

    this.socket.on('connect', () => {
      console.log('Connected to /tracking realtime socket');
    });

    this.socket.on('trip:location', (location: MapLocationPoint) => {
      useTripStore.getState().setLatestLocation(location);
    });

    this.socket.on('trip:geofence', (event: GeofenceBroadcastEvent) => {
      useTripStore.getState().setLastGeofenceEvent(event);
    });

    this.socket.on('connect_error', (err: Error) => {
      console.warn('Socket connection error:', err.message);
    });
  }

  joinTrip(tripId: string): void {
    this.socket?.emit('trip:join', { tripId });
  }

  leaveTrip(tripId: string): void {
    this.socket?.emit('trip:leave', { tripId });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const socketClient = new TrackingSocketClient();
