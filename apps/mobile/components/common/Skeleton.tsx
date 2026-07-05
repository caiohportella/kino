import { useEffect } from 'react'
import { ViewStyle, DimensionValue, View } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated'

interface BaseSkeletonProps {
  width?: DimensionValue
  height?: DimensionValue
  borderRadius?: number
  className?: string // For Tailwind/NativeWind
  style?: ViewStyle
}

interface SkeletonProps extends BaseSkeletonProps {
  layout?: 'profile' | 'watchlists' | 'watchlist-detail'
}

function BaseSkeleton({ width, height, borderRadius = 8, className, style }: BaseSkeletonProps) {
  const opacity = useSharedValue(0.3)

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    )
  }, [])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  return (
    <Animated.View
      className={`bg-white/10 ${className}`}
      style={[
        {
          width,
          height,
          borderRadius,
        },
        style,
        animatedStyle,
      ]}
    />
  )
}

// Sub-components for specific shapes
function Circle({
  size,
  className,
  style,
}: {
  size: number
  className?: string
  style?: ViewStyle
}) {
  return (
    <BaseSkeleton
      width={size}
      height={size}
      borderRadius={size / 2}
      className={className}
      style={style}
    />
  )
}

function Rect({ width, height, borderRadius, className, style }: BaseSkeletonProps) {
  return (
    <BaseSkeleton
      width={width}
      height={height}
      borderRadius={borderRadius}
      className={className}
      style={style}
    />
  )
}

// Text line skeleton
function TextLine({ width = '70%', height = 14, className, style }: BaseSkeletonProps) {
  return (
    <BaseSkeleton
      width={width}
      height={height}
      borderRadius={4}
      className={className}
      style={style}
    />
  )
}

// Layout Skeletons

function ProfileSkeleton() {
  return (
    <View className="flex-1 bg-primary">
      {/* Banner Skeleton */}
      <BaseSkeleton width="100%" height={192} className="mb-4" />

      {/* Profile Info Skeleton */}
      <View className="px-4 -mt-20 items-center">
        {/* Avatar */}
        <BaseSkeleton
          width={96}
          height={96}
          borderRadius={48}
          className="mb-4 border-4 border-primary"
        />

        {/* Name */}
        <BaseSkeleton width={160} height={24} className="mb-2" />
        {/* Bio */}
        <BaseSkeleton width={200} height={14} className="mb-1" />
        <BaseSkeleton width={120} height={12} className="mb-4" />
      </View>

      {/* Content Sections */}
      <View className="mt-8 px-4">
        <View className="flex-row justify-between mb-4">
          <BaseSkeleton width={140} height={24} />
          <BaseSkeleton width={20} height={16} />
        </View>
        <View className="flex-row">
          <BaseSkeleton width={112} height={160} borderRadius={8} className="mr-3" />
          <BaseSkeleton width={112} height={160} borderRadius={8} className="mr-3" />
          <BaseSkeleton width={112} height={160} borderRadius={8} />
        </View>
      </View>
    </View>
  )
}

function WatchlistsSkeleton() {
  return (
    <View className="flex-1 bg-primary p-4">
      {/* Header Skeleton */}
      <View className="flex-row justify-between items-center mb-6 mt-12">
        <TextLine width={120} height={32} />
        <Circle size={32} />
      </View>

      {/* List Skeletons */}
      {[1, 2, 3].map((i) => (
        <View key={i} className="mb-2 bg-surface p-4 rounded-lg">
          <View className="flex-row items-center gap-2 mb-2">
            <TextLine width={150} height={20} />
          </View>
          <TextLine width="80%" height={14} className="mb-2" />
          <TextLine width={100} height={12} className="ml-auto" />
        </View>
      ))}
    </View>
  )
}

function WatchlistDetailSkeleton() {
  return (
    <View className="flex-1 bg-primary pt-10">
      <View className="px-24 pt-2 pb-6 items-center">
        <TextLine width={200} height={40} className="mb-4 mt-8" />
        <TextLine width={250} height={16} className="mb-8" />

        {/* Participants */}
        <View className="flex-row gap-[-10] mb-6 justify-center">
          {[1, 2, 3].map((i) => (
            <Circle
              key={i}
              size={40}
              style={{ marginLeft: i > 1 ? -10 : 0 }}
              className="border-2 border-primary"
            />
          ))}
        </View>
        <View className="h-[1px] bg-white/10 w-full" />
      </View>

      {/* Grid */}
      <View className="flex-row flex-wrap px-3 gap-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Rect key={i} width="31%" height={160} borderRadius={8} className="mb-2" />
        ))}
      </View>
    </View>
  )
}

function MainSkeleton({ layout, ...props }: SkeletonProps) {
  if (layout === 'profile') return <ProfileSkeleton />
  if (layout === 'watchlists') return <WatchlistsSkeleton />
  if (layout === 'watchlist-detail') return <WatchlistDetailSkeleton />

  return <BaseSkeleton {...props} />
}

// Compound export
export const Skeleton = Object.assign(MainSkeleton, {
  Circle,
  Rect,
  Text: TextLine,
})
