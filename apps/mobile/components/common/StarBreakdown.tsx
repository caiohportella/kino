import { useMemo } from 'react'
import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { StarBreakdown as StarBreakdownType } from '~/types'

interface StarBreakdownProps {
  stats: StarBreakdownType
  totalRatings: number
}

export function StarBreakdown({ stats, totalRatings }: StarBreakdownProps) {
  const normalizedStats = useMemo(() => {
    const norm: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    if (!stats) return norm

    Object.entries(stats).forEach(([key, count]) => {
      const rating = parseFloat(key)
      // Round to nearest integer to bucket half-stars (e.g. 4.5 -> 5)
      // Also handles "5.0" -> 5
      const star = Math.round(rating)
      if (star >= 1 && star <= 5) {
        norm[star] = (norm[star] || 0) + Number(count)
      }
    })
    return norm
  }, [stats])

  if (totalRatings === 0) return null

  return (
    <View className="mt-4">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = normalizedStats[star] || 0
        const percentage = totalRatings > 0 ? (count / totalRatings) * 100 : 0

        return (
          <View key={star} className="mb-2 flex-row items-center">
            <View className="w-8 flex-row items-center justify-end mr-2 gap-1">
              <Text className="text-xs font-medium text-text-secondary">{star}</Text>
              <Ionicons name="star" size={10} color="#666" />
            </View>
            <View className="mx-2 h-2 flex-1 overflow-hidden rounded-full bg-[#333333]">
              <View
                className="h-full rounded-full bg-[#FFC107]"
                style={{ width: `${percentage}%` }}
              />
            </View>
          </View>
        )
      })}
    </View>
  )
}
