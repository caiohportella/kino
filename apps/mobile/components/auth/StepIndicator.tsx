import React from 'react'
import { View, Animated, StyleSheet } from 'react-native'

interface StepIndicatorProps {
  totalSteps: number
  currentStep: number
}

export function StepIndicator({ totalSteps, currentStep }: StepIndicatorProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: totalSteps }).map((_, index) => {
        const isActive = index + 1 === currentStep
        const isCompleted = index + 1 < currentStep

        return (
          <View key={index} style={styles.stepContainer}>
            <View
              style={[styles.dot, isActive && styles.activeDot, isCompleted && styles.completedDot]}
            />
            {index < totalSteps - 1 && (
              <View style={[styles.line, isCompleted && styles.completedLine]} />
            )}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  activeDot: {
    backgroundColor: '#1DB954',
    transform: [{ scale: 1.2 }],
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  completedDot: {
    backgroundColor: '#1DB954',
  },
  line: {
    width: 20,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 4,
  },
  completedLine: {
    backgroundColor: '#1DB954',
  },
})
