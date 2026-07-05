import { View, Text, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

type Props = {
  onLoginPress: () => void
}

export function UnauthenticatedView({ onLoginPress }: Props) {
  const { t } = useTranslation()

  return (
    <SafeAreaView className="flex-1 bg-primary">
      <View className="flex-1 items-center justify-center p-4">
        <Text className="mb-4 text-xl font-bold text-text-primary">{t('profile.title')}</Text>
        <Text className="mb-6 text-center text-text-secondary">{t('profile.loginPrompt')}</Text>
        <TouchableOpacity className="rounded-lg bg-accent px-6 py-3" onPress={onLoginPress}>
          <Text className="font-semibold text-white">{t('auth.logIn')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
