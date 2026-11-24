import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TripStatus } from '../store/tripStore';

const STATUS_COLORS: Record<TripStatus, string> = {
  PLANNED: '#38BDF8',
  ACTIVE: '#22C55E',
  COMPLETED: '#94A3B8',
  CANCELLED: '#F87171',
};

interface StatusBadgeProps {
  status: TripStatus;
}

export function StatusBadge({ status }: StatusBadgeProps): React.JSX.Element {
  return (
    <View
      style={[
        styles.badge,
        { borderColor: STATUS_COLORS[status] },
      ]}
    >
      <Text style={[styles.label, { color: STATUS_COLORS[status] }]}>
        {status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});
