import { ActivityIndicator, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/hooks/useAuth'

export default function ActivityScreen() {
  const { isAuthenticated, user } = useAuth()

  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#121212' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator size="small" color="#1DB954" />
          <Text style={{ color: '#fff' }}>Sign in to view activity.</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#121212' }}>
      <View style={{ flex: 1, padding: 16 }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>Activity</Text>
        <Text style={{ color: '#9ca3af', marginTop: 8 }}>
          Your social feed is being wired into the app shell.
        </Text>
      </View>
    </SafeAreaView>
  )
}
