import { create } from 'zustand';
import {
  clearAuthValues,
  getAuthValue,
  setAuthValue,
} from '../db/queue';

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  phone: string | null;
  hydrated: boolean;
  setAuth: (params: {
    accessToken: string;
    refreshToken: string;
    userId: string;
    phone?: string;
  }) => Promise<void>;
  clearAuth: () => Promise<void>;
  hydrateFromDb: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  userId: null,
  phone: null,
  hydrated: false,

  setAuth: async ({ accessToken, refreshToken, userId, phone }) => {
    await setAuthValue('accessToken', accessToken);
    await setAuthValue('refreshToken', refreshToken);
    await setAuthValue('userId', userId);
    if (phone) {
      await setAuthValue('phone', phone);
    }

    set((prev) => ({
      accessToken,
      refreshToken,
      userId,
      phone: phone ?? prev.phone,
      hydrated: true,
    }));
  },

  clearAuth: async () => {
    await clearAuthValues();
    set({
      accessToken: null,
      refreshToken: null,
      userId: null,
      phone: null,
      hydrated: true,
    });
  },

  hydrateFromDb: async () => {
    try {
      const [accessToken, refreshToken, userId, phone] = await Promise.all([
        getAuthValue('accessToken'),
        getAuthValue('refreshToken'),
        getAuthValue('userId'),
        getAuthValue('phone'),
      ]);
      set({ accessToken, refreshToken, userId, phone, hydrated: true });
    } catch (error: unknown) {
      console.warn('Failed to hydrate auth from SQLite:', error);
      set({ hydrated: true });
    }
  },
}));
