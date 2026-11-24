import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { socketClient } from './src/realtime/socketClient';
import { ContactsScreen } from './src/screens/ContactsScreen';
import { LiveMapScreen } from './src/screens/LiveMapScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { TripDetailScreen } from './src/screens/TripDetailScreen';
import { TripListScreen } from './src/screens/TripListScreen';
import { useAuthStore } from './src/store/authStore';
import { startSyncScheduler } from './src/sync/syncScheduler';

export type RootStackParamList = {
  Login: undefined;
  TripList: undefined;
  TripDetail: { tripId: string };
  LiveMap: { tripId: string };
  Contacts: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App(): React.JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const hydrated = useAuthStore((state) => state.hydrated);
  const hydrateFromDb = useAuthStore((state) => state.hydrateFromDb);

  useEffect(() => {
    void hydrateFromDb();
  }, [hydrateFromDb]);

  useEffect(() => {
    if (!accessToken) {
      socketClient.disconnect();
      return;
    }

    socketClient.connect(accessToken);
    const stopScheduler = startSyncScheduler();

    return () => {
      stopScheduler();
      socketClient.disconnect();
    };
  }, [accessToken]);

  if (!hydrated) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#38BDF8" />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#F8FAFC',
          contentStyle: { backgroundColor: '#0F172A' },
        }}
      >
        {accessToken ? (
          <>
            <Stack.Screen
              name="TripList"
              component={TripListScreen}
              options={{ title: 'NoctOwl Trips' }}
            />
            <Stack.Screen
              name="TripDetail"
              component={TripDetailScreen}
              options={{ title: 'Trip Protection' }}
            />
            <Stack.Screen
              name="LiveMap"
              component={LiveMapScreen}
              options={{ title: 'Live Map & Safe Zones' }}
            />
            <Stack.Screen
              name="Contacts"
              component={ContactsScreen}
              options={{ title: 'Emergency Contacts' }}
            />
          </>
        ) : (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
