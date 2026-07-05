import React from 'react'
import { View, StyleSheet, ViewProps } from 'react-native'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'

interface GlassContainerProps extends ViewProps {
  intensity?: number
  tint?: 'light' | 'dark' | 'default'
  children: React.ReactNode
}

export function GlassContainer({
  children,
  style,
  intensity = 50,
  tint = 'dark',
  ...props
}: GlassContainerProps) {
  return (
    <View style={[styles.container, style]} {...props}>
      <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  content: {
    padding: 24,
  },
})
