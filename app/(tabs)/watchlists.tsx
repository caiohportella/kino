// Watchlists screen
import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '~/hooks/useAuth';

import { useRouter, useFocusEffect } from 'expo-router';
import type { Watchlist } from '~/types';
import { dbService } from '~/services/database';
import { CreateWatchlistModal } from '~/components/CreateWatchlistModal';

import { ScreenHeader } from '~/components/ScreenHeader';

export default function WatchlistsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        loadWatchlists();
      } else {
        setLoading(false);
      }
    }, [isAuthenticated])
  );

  const loadWatchlists = async () => {
    try {
      const data = await dbService.getUserWatchlists();
      setWatchlists(data);
    } catch (error) {
      console.error('Error loading watchlists:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView className="flex-1 bg-primary">
        <View className="flex-1 items-center justify-center p-4">
          <Text className="mb-4 text-xl font-bold text-text-primary">Watchlists</Text>
          <Text className="mb-6 text-center text-text-secondary">
            Log in to create and manage watchlists
          </Text>
          <TouchableOpacity
            className="rounded-lg bg-accent px-6 py-3"
            onPress={() => router.push('/login' as any)}>
            <Text className="font-semibold text-white">Log In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-primary">
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-primary">
      <View className="flex-1">
        <ScreenHeader
          title="Watchlists"
          action={{
            icon: "plus",
            color: "#1DB954",
            onPress: () => setShowCreateModal(true)
          }}
        />

        {watchlists.length === 0 ? (
          <View className="flex-1 items-center justify-center p-4">
            <Text className="mb-4 text-center text-text-secondary">
              No watchlists yet. Create one to get started!
            </Text>
            <TouchableOpacity
              className="rounded-lg bg-accent px-6 py-3"
              onPress={() => setShowCreateModal(true)}
            >
              <Text className="font-semibold text-white">Create Watchlist</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={watchlists}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                className="mb-2 border-b border-black/20 bg-surface p-4"
                onPress={() => router.push(`/watchlist/${item.id}` as any)}
              >
                <View className="flex-row items-center gap-2 mb-1">
                  <Text className="text-lg font-semibold text-text-primary">{item.name}</Text>
                  {item.isShared && (
                    <View className="rounded-full bg-blue-900/50 px-2 py-1">
                      <Text className="text-xs font-medium text-blue-300">Shared</Text>
                    </View>
                  )}
                </View>
                {item.description && (
                  <Text className="mb-2 text-sm text-text-secondary">{item.description}</Text>
                )}
                <View className="flex-row items-center mt-1">
                  <Text className="ml-auto text-xs text-text-secondary">
                    Created {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={{ padding: 8 }}
          />
        )}
      </View>

      <CreateWatchlistModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(newList) => {
          setWatchlists([newList, ...watchlists]);
          setShowCreateModal(false);
        }}
      />
    </View>
  );
}
