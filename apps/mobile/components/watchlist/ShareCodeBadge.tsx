import { Text, View } from 'react-native'

interface ShareCodeBadgeProps {
  label: string
  variant?: 'green' | 'default'
  className?: string
}

export function ShareCodeBadge({ label, variant = 'green', className = '' }: ShareCodeBadgeProps) {
  const getColors = () => {
    switch (variant) {
      case 'green':
        return { bg: 'border border-accent/30 bg-accent/10', text: 'text-accent' }
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
