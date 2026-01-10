import React from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { TabBarIcon } from './TabBarIcon';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const insets = useSafeAreaInsets();

    // Map route names to icons to match the original layout
    const getIconName = (name: string) => {
        switch (name) {
            case 'index': return 'home';
            case 'search': return 'search';
            case 'diary': return 'book';
            case 'watchlists': return 'list';
            case 'profile': return 'person';
            default: return 'help';
        }
    };

    const isLiquid = isLiquidGlassAvailable();

    return (
        <View style={[styles.container, { bottom: insets.bottom + 10 }]}>
            {/* 
        On iOS, we use GlassView for the native liquid glass effect.
        If not available or on other platforms, we fall back to a blurred/semi-transparent view
        (Though expo-glass-effect is iOS specific, we want to be safe)
      */}
            <GlassView
                style={styles.glassBackground}
                glassEffectStyle="regular"
                isInteractive={true}
            />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.1)' }]} />

            <View style={styles.content}>
                {state.routes.map((route, index) => {
                    const { options } = descriptors[route.key];
                    const isFocused = state.index === index;

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    const onLongPress = () => {
                        navigation.emit({
                            type: 'tabLongPress',
                            target: route.key,
                        });
                    };

                    return (
                        <TouchableOpacity
                            key={route.key}
                            accessibilityRole="button"
                            accessibilityState={isFocused ? { selected: true } : {}}
                            accessibilityLabel={options.tabBarAccessibilityLabel}
                            onPress={onPress}
                            onLongPress={onLongPress}
                            style={styles.tabItem}
                            activeOpacity={0.7}
                        >
                            <TabBarIcon
                                name={getIconName(route.name) as any}
                                color={isFocused ? '#1DB954' : '#B0B0B0'}
                            />
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 24,
        right: 24,
        height: 64,
        borderRadius: 32,
        overflow: 'hidden',
        // iOS shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        // Android elevation
        elevation: 8,
        backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(30, 30, 30, 0.8)',
    },
    glassBackground: {
        ...StyleSheet.absoluteFillObject,
    },
    content: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 8,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        paddingTop: 4,
    }
});
