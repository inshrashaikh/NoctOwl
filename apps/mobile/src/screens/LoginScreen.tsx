import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { requestOtp, verifyOtp } from '../api/auth';
import { useAuthStore } from '../store/authStore';

export function LoginScreen(): React.JSX.Element {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleRequestOtp = async (): Promise<void> => {
    if (!phone.trim()) {
      Alert.alert('Phone Required', 'Enter your phone number with country code.');
      return;
    }
    setLoading(true);
    try {
      await requestOtp(phone.trim());
      setOtpSent(true);
    } catch {
      Alert.alert('Error', 'Unable to send OTP. Check API connectivity.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (): Promise<void> => {
    if (otp.trim().length !== 6) {
      Alert.alert('Invalid OTP', 'Enter the 6-digit verification code.');
      return;
    }
    setLoading(true);
    try {
      const result = await verifyOtp(phone.trim(), otp.trim());
      await setAuth({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        userId: result.userId,
        phone: phone.trim(),
      });
    } catch {
      Alert.alert('Verification Failed', 'The OTP is invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>NoctOwl</Text>
      <Text style={styles.subtitle}>Night-Travel Safety Companion</Text>

      <TextInput
        style={styles.input}
        placeholder="+911234567890"
        placeholderTextColor="#64748B"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        editable={!otpSent && !loading}
      />

      {otpSent ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="6-digit OTP"
            placeholderTextColor="#64748B"
            keyboardType="number-pad"
            maxLength={6}
            value={otp}
            onChangeText={setOtp}
            editable={!loading}
          />
          <Pressable
            style={styles.primaryButton}
            onPress={() => void handleVerifyOtp()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0F172A" />
            ) : (
              <Text style={styles.primaryButtonText}>Verify & Sign In</Text>
            )}
          </Pressable>
          <Pressable
            style={styles.linkButton}
            onPress={() => {
              setOtpSent(false);
              setOtp('');
            }}
          >
            <Text style={styles.linkText}>Change phone number</Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          style={styles.primaryButton}
          onPress={() => void handleRequestOtp()}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#0F172A" />
          ) : (
            <Text style={styles.primaryButtonText}>Send OTP</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#94A3B8',
    marginBottom: 28,
  },
  input: {
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 14,
  },
  primaryButton: {
    backgroundColor: '#38BDF8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
  },
  linkButton: {
    marginTop: 14,
    alignItems: 'center',
  },
  linkText: {
    color: '#38BDF8',
    fontSize: 14,
  },
});
