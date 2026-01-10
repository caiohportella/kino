// Login screen
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '~/utils/supabase';
import { client } from '~/utils/auth-client';
import { Feather } from '@expo/vector-icons';
import { AntDesign } from '@expo/vector-icons';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Login Failed', error instanceof Error ? error.message : 'An error occurred');
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
      <Text className="mb-8 text-center text-3xl font-bold text-white">Welcome to Kino</Text>

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

      <View className="mb-6">
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

      <TouchableOpacity
        className="mb-4 items-center rounded-lg bg-accent py-4"
        onPress={handleLogin}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color="black" />
        ) : (
          <Text className="text-base font-bold text-black">Sign In</Text>
        )}
      </TouchableOpacity>

      <View className="mb-4 flex-row items-center justify-center">
        <Text className="text-gray-400">Don&apos;t have an account? </Text>
        <TouchableOpacity onPress={() => router.push('/register' as any)}>
          <Text className="font-bold text-accent">Sign Up</Text>
        </TouchableOpacity>
      </View>

      <View className="mt-4 border-t border-white/10 pt-4">
        <Text className="mb-2 text-center text-gray-400">Or continue with</Text>
        <TouchableOpacity
          className="flex-row items-center justify-center rounded-lg border border-white/20 bg-surface py-3 space-x-3"
          onPress={async () => {
            await client.signIn.social({
              provider: 'google',
              callbackURL: 'kino://(tabs)',
            });
          }}>
          <AntDesign name="google" size={20} color="white" />
          <Text className="font-medium text-white ml-2">Continue with Google</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
