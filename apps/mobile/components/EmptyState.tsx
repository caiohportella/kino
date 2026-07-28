import React from 'react'
import { Image, ImageSourcePropType, Text, View, ViewProps } from 'react-native'

interface EmptyStateProps extends ViewProps {
  title: string
  description?: string
  image: ImageSourcePropType
}

export const EmptyState = ({
  title,
  description,
  image,
  style,
  className,
  ...props
}: EmptyStateProps) => {
  return (
    <View className={`items-center justify-center p-8 ${className || ''}`} style={style} {...props}>
      <Image source={image} className="w-48 h-48 mb-6" resizeMode="contain" />
      <Text className="text-text-primary text-xl font-bold text-center mb-2">{title}</Text>
      {description && (
        <Text className="text-text-secondary text-center text-base px-4">{description}</Text>
      )}
    </View>
  )
}
