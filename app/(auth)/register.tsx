// Register screen
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '~/utils/supabase';
import { Feather } from '@expo/vector-icons';

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  const handleRegister = async () => {
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      Alert.alert('Success', 'Account created! Please check your email to verify your account.');
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert(
        'Registration Failed',
        error instanceof Error ? error.message : 'An error occurred'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 justify-center bg-primary px-6">
      <View className="items-center mb-8">
        <Image
          source={require('../../assets/logo.png')}
          style={{ width: 120, height: 120 }}
          resizeMode="contain"
        />
      </View>
      <Text className="mb-8 text-center text-3xl font-bold text-white">Create Account</Text>

      <View className="mb-4">
        <Text className="mb-2 text-sm font-medium text-white">Email</Text>
        <TextInput
          className={`rounded-lg border px-4 py-3 text-base ${emailFocused ? 'border-accent text-accent' : 'border-white/20 text-white'
            }`}
          placeholder="Enter your email"
          placeholderTextColor="#666"
          value={email}
          onChangeText={setEmail}
          onFocus={() => setEmailFocused(true)}
          onBlur={() => setEmailFocused(false)}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
      </View>

      <View className="mb-4">
        <Text className="mb-2 text-sm font-medium text-white">Password</Text>
        <View className="justify-center">
          <TextInput
            className={`rounded-lg border px-4 py-3 text-base pr-12 ${passwordFocused ? 'border-accent text-accent' : 'border-white/20 text-white'
              }`}
            placeholder="Enter your password"
            placeholderTextColor="#666"
            value={password}
            onChangeText={setPassword}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            secureTextEntry={!passwordVisible}
            autoComplete="password"
          />
          <TouchableOpacity
            className="absolute right-4"
            onPress={() => setPasswordVisible(!passwordVisible)}>
            <Feather
              name={passwordVisible ? 'eye' : 'eye-off'}
              size={20}
              color={passwordFocused ? '#1DB954' : '#666'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View className="mb-6">
        <Text className="mb-2 text-sm font-medium text-white">Confirm Password</Text>
        <View className="justify-center">
          <TextInput
            className={`rounded-lg border px-4 py-3 text-base pr-12 ${confirmPasswordFocused ? 'border-accent text-accent' : 'border-white/20 text-white'
              }`}
            placeholder="Confirm your password"
            placeholderTextColor="#666"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            onFocus={() => setConfirmPasswordFocused(true)}
            onBlur={() => setConfirmPasswordFocused(false)}
            secureTextEntry={!confirmPasswordVisible}
            autoComplete="password"
          />
          <TouchableOpacity
            className="absolute right-4"
            onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)}>
            <Feather
              name={confirmPasswordVisible ? 'eye' : 'eye-off'}
              size={20}
              color={confirmPasswordFocused ? '#1DB954' : '#666'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        className="mb-4 items-center rounded-lg bg-accent py-4"
        onPress={handleRegister}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color="black" />
        ) : (
          <Text className="text-base font-bold text-black">Sign Up</Text>
        )}
      </TouchableOpacity>

      <View className="flex-row items-center justify-center">
        <Text className="text-gray-400">Already have an account? </Text>
        <TouchableOpacity onPress={() => router.push('/login' as any)}>
          <Text className="font-bold text-accent">Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
