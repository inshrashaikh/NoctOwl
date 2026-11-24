import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    console.warn(
      `API request failed (${error.config?.method?.toUpperCase()} ${error.config?.url}): status=${status ?? 'network'}`,
    );

    if (status === 401 && error.config && !error.config.url?.includes('/auth/')) {
      const state = useAuthStore.getState();
      if (state.refreshToken && state.userId) {
        try {
          const refreshRes = await axios.post<{
            accessToken: string;
            refreshToken: string;
          }>(`${API_BASE_URL}/auth/refresh`, {
            refreshToken: state.refreshToken,
          });
          await state.setAuth({
            accessToken: refreshRes.data.accessToken,
            refreshToken: refreshRes.data.refreshToken,
            userId: state.userId,
          });
          error.config.headers.Authorization = `Bearer ${refreshRes.data.accessToken}`;
          return apiClient.request(error.config);
        } catch (refreshErr: unknown) {
          console.warn('Token refresh failed, clearing auth:', refreshErr);
          await state.clearAuth();
        }
      }
    }

    return Promise.reject(error);
  },
);
