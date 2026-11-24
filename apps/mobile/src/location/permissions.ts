import * as Location from 'expo-location';

export interface PermissionResult {
  foregroundGranted: boolean;
  backgroundGranted: boolean;
}

export async function requestLocationPermissions(): Promise<PermissionResult> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    return { foregroundGranted: false, backgroundGranted: false };
  }

  const bg = await Location.requestBackgroundPermissionsAsync();
  return {
    foregroundGranted: true,
    backgroundGranted: bg.status === 'granted',
  };
}
