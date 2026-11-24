import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { logoutApi } from '../api/auth';
import { createTrip, listTrips } from '../api/trips';
import { StatusBadge } from '../components/StatusBadge';
import { useAuthStore } from '../store/authStore';
import { TripSummary, useTripStore } from '../store/tripStore';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'TripList'>;

export function TripListScreen({ navigation }: Props): React.JSX.Element {
  const trips = useTripStore((state) => state.trips);
  const setTrips = useTripStore((state) => state.setTrips);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [refreshing, setRefreshing] = useState(false);

  const loadTrips = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await listTrips();
      setTrips(data);
    } catch {
      Alert.alert('Offline', 'Could not refresh trips from server.');
    } finally {
      setRefreshing(false);
    }
  }, [setTrips]);

  useEffect(() => {
    void loadTrips();
  }, [loadTrips]);

  const handleCreateTrip = async (): Promise<void> => {
    try {
      const created = await createTrip({
        title: `Night Trip ${new Date().toLocaleTimeString()}`,
      });
      setTrips([created, ...trips]);
      navigation.navigate('TripDetail', { tripId: created.id });
    } catch {
      Alert.alert('Error', 'Failed to create trip.');
    }
  };

  const handleLogout = async (): Promise<void> => {
    await logoutApi();
    await clearAuth();
  };

  const renderTrip = ({ item }: { item: TripSummary }): React.JSX.Element => (
    <Pressable
      style={styles.card}
      onPress={() => navigation.navigate('TripDetail', { tripId: item.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.title || 'Untitled Trip'}</Text>
        <StatusBadge status={item.status} />
      </View>
      <Text style={styles.cardMeta}>
        Created: {new Date(item.createdAt).toLocaleString()}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.actionRow}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => void handleCreateTrip()}
        >
          <Text style={styles.primaryButtonText}>+ New Trip</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Contacts')}
        >
          <Text style={styles.secondaryButtonText}>Contacts</Text>
        </Pressable>
        <Pressable
          style={styles.logoutButton}
          onPress={() => void handleLogout()}
        >
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>
      </View>

      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        renderItem={renderTrip}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadTrips()}
            tintColor="#38BDF8"
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No trips yet. Tap "+ New Trip" to plan one.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#38BDF8',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0F172A',
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 11,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#F8FAFC',
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    justifyContent: 'center',
  },
  logoutText: {
    color: '#F87171',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  cardMeta: {
    color: '#94A3B8',
    fontSize: 12,
  },
  emptyText: {
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 40,
  },
});
