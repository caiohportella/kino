import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenHeaderProps {
    title: string;
    action?: {
        icon?: keyof typeof Feather.glyphMap;
        label?: string;
        color?: string;
        onPress: () => void;
    };
}

export function ScreenHeader({ title, action }: Omit<ScreenHeaderProps, 'subtitle'>) {
    const insets = useSafeAreaInsets();

    return (
        <View
            className="flex-row items-center justify-between px-6 pb-4"
            style={{ paddingTop: insets.top + 12 }}
        >
            <View>
                <Text className="text-3xl font-extrabold text-text-primary tracking-tight shadow-sm">
                    {title}
                    <Text className="text-accent">.</Text>
                </Text>
            </View>

            {/* Action Button */}
            {action && (
                <TouchableOpacity
                    className="rounded-full bg-surface border border-white/10 w-10 h-10 items-center justify-center shadow-sm"
                    onPress={action.onPress}
                >
                    <Feather name={action.icon || "plus"} size={20} color={action.color || "#E0E0E0"} />
                </TouchableOpacity>
            )}
        </View>
    );
}
