import { View, Text } from 'react-native'

interface ShareCodeBadgeProps {
  label: string
  variant?: 'blue' | 'green' | 'default'
  className?: string
}

export function ShareCodeBadge({ label, variant = 'blue', className = '' }: ShareCodeBadgeProps) {
  const getColors = () => {
    switch (variant) {
      case 'blue':
        return { bg: 'bg-blue-900/50', text: 'text-blue-300' }
      case 'green':
        return { bg: 'bg-green-900/50', text: 'text-green-300' }
      default:
        return { bg: 'bg-surface', text: 'text-text-secondary' }
    }
  }

  const colors = getColors()

  return (
    <View className={`rounded-full px-2 py-1 ${colors.bg} ${className}`}>
      <Text className={`text-xs font-medium ${colors.text}`}>{label}</Text>
    </View>
  )
}
