import { apiClient } from './client';

export interface EmergencyContactItem {
  id: string;
  name: string;
  phone: string;
  relation: string | null;
  priority: number;
  fcmToken: string | null;
}

export async function requestOtp(phone: string): Promise<{ requestId: string }> {
  try {
    const res = await apiClient.post<{ requestId: string }>('/auth/otp/request', {
      phone,
    });
    return res.data;
  } catch (error: unknown) {
    console.error('requestOtp failed:', error);
    throw error;
  }
}

export async function verifyOtp(
  phone: string,
  otp: string,
): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
  try {
    const res = await apiClient.post<{
      accessToken: string;
      refreshToken: string;
      userId: string;
    }>('/auth/otp/verify', { phone, otp });
    return res.data;
  } catch (error: unknown) {
    console.error('verifyOtp failed:', error);
    throw error;
  }
}

export async function logoutApi(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } catch (error: unknown) {
    console.warn('logoutApi failed:', error);
  }
}

export async function listContacts(): Promise<EmergencyContactItem[]> {
  try {
    const res = await apiClient.get<EmergencyContactItem[]>('/users/me/contacts');
    return res.data;
  } catch (error: unknown) {
    console.error('listContacts failed:', error);
    throw error;
  }
}

export async function createContact(input: {
  name: string;
  phone: string;
  relation?: string;
  priority?: number;
  fcmToken?: string;
}): Promise<EmergencyContactItem> {
  try {
    const res = await apiClient.post<EmergencyContactItem>(
      '/users/me/contacts',
      input,
    );
    return res.data;
  } catch (error: unknown) {
    console.error('createContact failed:', error);
    throw error;
  }
}

export async function deleteContact(id: string): Promise<void> {
  try {
    await apiClient.delete(`/users/me/contacts/${id}`);
  } catch (error: unknown) {
    console.error('deleteContact failed:', error);
    throw error;
  }
}
