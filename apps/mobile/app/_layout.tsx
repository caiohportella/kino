import '../i18n'
import { loadSavedLanguage } from '../i18n'
import '../global.css'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { TouchableWithoutFeedback, Keyboard, View } from 'react-native'
import { useEffect } from 'react'

import { StatusBar } from 'expo-status-bar'

import { Stack } from 'expo-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '~/utils/queryClient'

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
}

export default function RootLayout() {
  // Load saved language preference on app start
  useEffect(() => {
    loadSavedLanguage()
  }, [])
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: '#121212' },
                headerTintColor: '#E0E0E0',
                contentStyle: { backgroundColor: '#121212' },
                headerTitleStyle: { color: '#E0E0E0' },
              }}
            >
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="title/[id]"
                options={{
                  title: 'Title Details',
                  headerShown: false,
                  presentation: 'modal',
                }}
              />
              <Stack.Screen
                name="profile/[id]"
                options={{
                  headerShown: false,
                  presentation: 'card', // standard stack push
                }}
              />
              <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
            </Stack>
            <StatusBar style="light" />
          </View>
        </TouchableWithoutFeedback>
      </GestureHandlerRootView>
    </QueryClientProvider>
  )
}
