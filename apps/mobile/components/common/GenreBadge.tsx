import React from 'react'
import { Text, TouchableOpacity, StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

interface GenreBadgeProps {
  name: string
  isActive: boolean
  onPress: () => void
}

export function GenreBadge({ name, isActive, onPress }: GenreBadgeProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.container, isActive && styles.activeContainer]}
    >
      {isActive ? (
        <LinearGradient
          colors={['#1DB954', '#158a3e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <Text style={styles.activeText}>{name}</Text>
        </LinearGradient>
      ) : (
        <View style={styles.inactiveBadge}>
          <Text style={styles.text}>{name}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    marginRight: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  activeContainer: {
    // Shadow for active state
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  gradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inactiveBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
  },
  text: {
    color: '#E0E0E0',
    fontSize: 13,
    fontWeight: '500',
  },
  activeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
})
