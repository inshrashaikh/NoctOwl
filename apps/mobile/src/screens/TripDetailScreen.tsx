import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  getTrip,
  triggerEmergency,
  updateTripStatus,
} from '../api/trips';
import { StatusBadge } from '../components/StatusBadge';
import { enqueue } from '../db/queue';
import {
  startTripTracking,
  stopTripTracking,
} from '../location/trackingService';
import { socketClient } from '../realtime/socketClient';
import { TripSummary, useTripStore } from '../store/tripStore';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'TripDetail'>;

export function TripDetailScreen({
  route,
  navigation,
}: Props): React.JSX.Element {
  const { tripId } = route.params;
  const [trip, setTrip] = useState<TripSummary | null>(null);
  const isTracking = useTripStore((state) => state.isTracking);
  const setActiveTrip = useTripStore((state) => state.setActiveTrip);

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const data = await getTrip(tripId);
        setTrip(data);
        setActiveTrip(data);
      } catch {
        Alert.alert('Error', 'Could not load trip details.');
      }
    };
    void load();
  }, [tripId, setActiveTrip]);

  const handleStartTrip = async (): Promise<void> => {
    try {
      const updated = await updateTripStatus(tripId, 'ACTIVE');
      setTrip(updated);
      setActiveTrip(updated);
      socketClient.joinTrip(tripId);
      await startTripTracking(tripId);
    } catch {
      await enqueue('TRIP_STATUS', { tripId, status: 'ACTIVE' });
      Alert.alert('Queued Offline', 'Trip start queued for offline sync.');
    }
  };

  const handleStopTrip = async (): Promise<void> => {
    try {
      await stopTripTracking();
      socketClient.leaveTrip(tripId);
      const updated = await updateTripStatus(tripId, 'COMPLETED');
      setTrip(updated);
      setActiveTrip(updated);
    } catch {
      await enqueue('TRIP_STATUS', { tripId, status: 'COMPLETED' });
      Alert.alert('Queued Offline', 'Trip completion queued for sync.');
    }
  };

  const handleSos = async (): Promise<void> => {
    try {
      const res = await triggerEmergency(tripId, { source: 'mobile_sos' });
      Alert.alert(
        'SOS Sent',
        `Emergency alert queued (ID: ${res.notificationId.slice(0, 8)}...)`,
      );
    } catch {
      Alert.alert('SOS Error', 'Could not trigger emergency alert.');
    }
  };

  return (
    <View style={styles.container}>
      {trip ? (
        <>
          <Text style={styles.title}>{trip.title || 'Night Trip'}</Text>
          <StatusBadge status={trip.status} />
          <Text style={styles.meta}>Trip ID: {trip.id}</Text>
          <Text style={styles.meta}>
            Tracking: {isTracking ? 'Background GPS Active' : 'Idle'}
          </Text>

          <View style={styles.buttons}>
            {trip.status === 'PLANNED' ? (
              <Pressable
                style={styles.startButton}
                onPress={() => void handleStartTrip()}
              >
                <Text style={styles.buttonText}>Start Trip & Tracking</Text>
              </Pressable>
            ) : null}

            {trip.status === 'ACTIVE' ? (
              <Pressable
                style={styles.stopButton}
                onPress={() => void handleStopTrip()}
              >
                <Text style={styles.buttonText}>Stop Trip</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={styles.mapButton}
              onPress={() => navigation.navigate('LiveMap', { tripId })}
            >
              <Text style={styles.mapButtonText}>Open Live Map</Text>
            </Pressable>

            <Pressable
              style={styles.sosButton}
              onPress={() => void handleSos()}
            >
              <Text style={styles.sosText}>SOS EMERGENCY</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Text style={styles.meta}>Loading trip...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 20,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 10,
  },
  meta: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 8,
  },
  buttons: {
    marginTop: 28,
    gap: 12,
  },
  startButton: {
    backgroundColor: '#22C55E',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 16,
  },
  mapButton: {
    backgroundColor: '#1E293B',
    borderColor: '#38BDF8',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  mapButtonText: {
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 16,
  },
  sosButton: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 12,
  },
  sosText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 1,
  },
});
