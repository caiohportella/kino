import { View, TouchableOpacity, StyleSheet, Platform, Image } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { TabBarIcon } from './TabBarIcon'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()

  // Map route names to icons to match the original layout while adding outline states for inactive tabs
  const getIconName = (name: string, isFocused: boolean): any => {
    switch (name) {
      case 'index':
        return isFocused ? 'home' : 'home-outline'
      case 'search':
        return isFocused ? 'search' : 'search-outline'
      case 'diary':
        return isFocused ? 'reader' : 'reader-outline'
      case 'watchlists':
        return isFocused ? 'albums' : 'albums-outline'
      case 'profile':
        return isFocused ? 'person' : 'person-outline'
      default:
        return 'help'
    }
  }

  return (
    <View style={[styles.container, { bottom: insets.bottom + 10 }]}>
      <BlurView intensity={35} tint="dark" style={styles.glassBackground} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />

      <View style={styles.content}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]
          const isFocused = state.index === index

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name)
            }
          }

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            })
          }

          const isProfile = route.name === 'profile'
          // Optional subtle red dots for 'search' and 'profile' to closely mimic the provided model
          const showNotificationDot = (route.name === 'search' || route.name === 'profile') && !isFocused

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              style={[styles.tabItem, isFocused && styles.tabItemFocused]}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, isFocused && styles.activeIconContainer]}>
                <View style={styles.iconWrapper}>
                  {isProfile ? (
                    <View style={styles.profileImageContainer}>
                      <Image
                        source={{ uri: 'https://i.pravatar.cc/150?img=68' }}
                        style={styles.profileImage}
                      />
                    </View>
                  ) : (
                    <TabBarIcon
                      name={getIconName(route.name, isFocused)}
                      color={'#FFF'}
                    />
                  )}
                  {showNotificationDot && (
                    <View style={styles.notificationDot} />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 68,
    borderRadius: 34,
    overflow: 'hidden',
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    // Android elevation
    elevation: 8,
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(20, 20, 20, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  glassBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabItemFocused: {
    flex: 1.6, // Active item takes more space for the expanded pill
  },
  iconContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconContainer: {
    width: '100%',
    height: 54, // The grey pill background height
    borderRadius: 27,
    backgroundColor: 'rgba(255, 255, 255, 0.2)', // Pronounced grey pill for active state
  },
  iconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    bottom: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF2D55',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  profileImageContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  }
})
