import React from 'react';
import { StyleSheet, Dimensions, TouchableOpacity, View } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    runOnJS,
    Easing,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CurtainLayoutProps {
    children: React.ReactNode;
    onBack?: () => void;
}

export function CurtainLayout({ children, onBack }: CurtainLayoutProps) {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const translateY = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: translateY.value }],
        };
    });

    const handlePress = () => {
        translateY.value = withTiming(
            SCREEN_HEIGHT, // Animate DOWN to the bottom of the screen
            {
                duration: 500,
                easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            },
            (finished) => {
                if (finished) {
                    if (onBack) {
                        runOnJS(onBack)();
                    } else {
                        runOnJS(router.back)();
                    }
                }
            }
        );
    };

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.content, animatedStyle]}>
                {children}

                {/* Button is part of the moving content or fixed? 
            User said "Place a button at the top left... when a title is opened".
            "Displaying screen should be going down". 
            Usually the close button usually moves WITH the content in these card dismissals, 
            or stays fixed if it's external. 
            If I put it INSIDE Animated.View, it slides down with the content.
            The user said "Add a Curtain-Close Button... Place a button at the top left".
            If the screen goes down, the button should probably go down with it if it's attached to that "card".
            Let's put it inside.
        */}
                <View style={[styles.buttonContainer, { top: insets.top + 10, left: 16 }]}>
                    <TouchableOpacity
                        onPress={handlePress}
                        style={styles.button}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="chevron-down" size={28} color="#FFF" />
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent', // Ensure background is transparent to potentially see behind? 
        // Actually if navigation stack is opaque, we'll just see window color.
    },
    content: {
        flex: 1,
        backgroundColor: '#09090b', // Ensure the content itself has the background
        overflow: 'hidden', // Ensure rounded corners if we add them later
    },
    buttonContainer: {
        position: 'absolute',
        zIndex: 100,
    },
    button: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
});
