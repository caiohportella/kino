import { Ionicons } from '@expo/vector-icons'

export const TabBarIcon = (props: { name: keyof typeof Ionicons.glyphMap; color: string }) => {
  return <Ionicons size={24} {...props} />
}
