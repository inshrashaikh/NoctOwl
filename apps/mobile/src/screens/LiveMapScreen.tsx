import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
} from '@maplibre/maplibre-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getTripMarkers, getTripTrail } from '../api/trips';
import { useTripStore } from '../store/tripStore';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'LiveMap'>;

const MAP_STYLE_URL =
  process.env.EXPO_PUBLIC_MAP_STYLE_URL ||
  'https://tiles.openfreemap.org/styles/liberty';

export function LiveMapScreen({ route }: Props): React.JSX.Element {
  const { tripId } = route.params;
  const trail = useTripStore((state) => state.trail);
  const latestLocation = useTripStore((state) => state.latestLocation);
  const safeZones = useTripStore((state) => state.safeZones);
  const lastGeofenceEvent = useTripStore((state) => state.lastGeofenceEvent);
  const setTrail = useTripStore((state) => state.setTrail);
  const setSafeZones = useTripStore((state) => state.setSafeZones);

  useEffect(() => {
    const loadMapData = async (): Promise<void> => {
      try {
        const [trailData, markersData] = await Promise.all([
          getTripTrail(tripId),
          getTripMarkers(tripId),
        ]);
        setTrail(trailData.locations);
        setSafeZones(markersData.safeZones);
      } catch (error: unknown) {
        console.warn('Failed to load map trail/markers:', error);
      }
    };
    void loadMapData();
  }, [tripId, setTrail, setSafeZones]);

  const centerCoords = useMemo<[number, number]>(() => {
    if (latestLocation) {
      return [latestLocation.lon, latestLocation.lat];
    }
    if (trail.length > 0) {
      const last = trail[trail.length - 1];
      return [last.lon, last.lat];
    }
    return [77.5946, 12.9716];
  }, [latestLocation, trail]);

  const trailFeatureCollection = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features:
        trail.length >= 2
          ? [
              {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: trail.map((pt) => [pt.lon, pt.lat]),
                },
              },
            ]
          : [],
    }),
    [trail],
  );

  const safeZonesCollection = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: safeZones
        .filter((z) => z.geometry?.coordinates?.length > 0)
        .map((zone) => ({
          type: 'Feature',
          properties: { name: zone.name, color: zone.color },
          geometry: {
            type: 'Polygon',
            coordinates: zone.geometry.coordinates,
          },
        })),
    }),
    [safeZones],
  );

  const markerCollection = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: latestLocation
        ? [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Point',
                coordinates: [latestLocation.lon, latestLocation.lat],
              },
            },
          ]
        : [],
    }),
    [latestLocation],
  );

  return (
    <View style={styles.container}>
      <MapLibreMap style={styles.map} mapStyle={MAP_STYLE_URL}>
        <Camera
          initialViewState={{ center: centerCoords, zoom: 14 }}
          center={centerCoords}
          zoom={14}
        />

        <GeoJSONSource id="safe-zones-source" data={safeZonesCollection}>
          <Layer
            id="safe-zones-fill"
            type="fill"
            paint={{ 'fill-color': '#3B82F6', 'fill-opacity': 0.2 }}
          />
          <Layer
            id="safe-zones-outline"
            type="line"
            paint={{ 'line-color': '#3B82F6', 'line-width': 2 }}
          />
        </GeoJSONSource>

        <GeoJSONSource id="trail-source" data={trailFeatureCollection}>
          <Layer
            id="trail-line"
            type="line"
            paint={{ 'line-color': '#38BDF8', 'line-width': 4 }}
          />
        </GeoJSONSource>

        <GeoJSONSource id="live-marker-source" data={markerCollection}>
          <Layer
            id="live-marker-circle"
            type="circle"
            paint={{
              'circle-radius': 8,
              'circle-color': '#22C55E',
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': 2,
            }}
          />
        </GeoJSONSource>
      </MapLibreMap>

      {lastGeofenceEvent ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Geofence {lastGeofenceEvent.eventType}: {lastGeofenceEvent.zoneName}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  map: {
    flex: 1,
  },
  banner: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderColor: '#38BDF8',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  bannerText: {
    color: '#F8FAFC',
    fontWeight: '700',
    textAlign: 'center',
  },
});
