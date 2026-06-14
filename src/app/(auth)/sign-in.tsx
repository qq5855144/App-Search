import { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { supabase } from '@/client/supabase';

export default function SignIn() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sendOtp = async () => {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) {
      setError(error.message);
    } else {
      setStep('otp');
    }
    setLoading(false);
  };

  const verifyOtp = async () => {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <View className="flex-1 justify-center px-6 bg-white">
      <Text className="text-2xl font-bold mb-8 text-center">Sign In</Text>

      <TextInput
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4"
        placeholder="Phone number"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoCapitalize="none"
        editable={step === 'phone'}
      />

      {step === 'otp' && (
        <View className="flex-row mb-4 gap-2">
          <TextInput
            className="flex-1 border border-gray-300 rounded-lg px-4 py-3"
            placeholder="Verification code"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            autoFocus
          />
          <TouchableOpacity
            className="border border-gray-300 rounded-lg px-4 py-3 justify-center"
            onPress={() => { setStep('phone'); setOtp(''); setError(''); }}
          >
            <Text className="text-gray-500 text-sm">Resend</Text>
          </TouchableOpacity>
        </View>
      )}

      {error ? (
        <Text className="text-red-500 text-sm mb-4">{error}</Text>
      ) : (
        <View className="mb-4" />
      )}

      <TouchableOpacity
        className="bg-black rounded-lg py-3 items-center"
        onPress={step === 'phone' ? sendOtp : verifyOtp}
        disabled={loading}
      >
        <Text className="text-white font-semibold">
          {loading ? 'Loading...' : step === 'phone' ? 'Send Code' : 'Verify'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
