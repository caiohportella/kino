import '../global.css';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TouchableWithoutFeedback, Keyboard, View } from 'react-native';

import { StatusBar } from 'expo-status-bar';

import { Stack } from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  return (
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
            <Stack.Screen name="title/[id]" options={{
              title: 'Title Details',
              headerShown: false,
              presentation: 'transparentModal',
              animation: 'fade' // Fade in, then we slide out manually
            }} />
            <Stack.Screen name="title/[id]/episodes" options={{
              title: 'Episodes',
              headerShown: false,
              presentation: 'transparentModal',
              animation: 'fade'
            }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          </Stack>
          <StatusBar style="light" />
        </View>
      </TouchableWithoutFeedback>
    </GestureHandlerRootView>
  );
}
