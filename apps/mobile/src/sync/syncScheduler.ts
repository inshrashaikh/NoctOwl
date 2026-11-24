import NetInfo from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';
import { flush } from './syncEngine';

const SYNC_INTERVAL_MS = 30_000;

export function startSyncScheduler(): () => void {
  let wasOnline = false;

  const intervalId = setInterval(() => {
    void flush();
  }, SYNC_INTERVAL_MS);

  const netUnsubscribe = NetInfo.addEventListener((state) => {
    const isOnline = Boolean(
      state.isConnected && state.isInternetReachable !== false,
    );
    if (isOnline && !wasOnline) {
      void flush();
    }
    wasOnline = isOnline;
  });

  const appStateSubscription = AppState.addEventListener(
    'change',
    (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void flush();
      }
    },
  );

  return () => {
    clearInterval(intervalId);
    netUnsubscribe();
    appStateSubscription.remove();
  };
}
