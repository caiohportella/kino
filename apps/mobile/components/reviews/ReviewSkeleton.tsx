import { View } from 'react-native'

export function ReviewSkeleton() {
  return (
    <View className="flex-row gap-3" accessibilityElementsHidden>
      <View className="h-10 w-10 rounded-full bg-primary" />
      <View className="flex-1 gap-3">
        <View className="h-4 w-2/3 rounded bg-primary" />
        <View className="h-4 w-full rounded bg-primary" />
        <View className="h-4 w-4/5 rounded bg-primary" />
      </View>
    </View>
  )
}
