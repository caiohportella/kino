// Watch diary screen
import { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '~/hooks/useAuth';
import { supabase } from '~/utils/supabase';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '~/components/ScreenHeader';

interface DiaryEntry {
  id: string;
  titleId: string;
  titleName: string;
  watchedAt: string;
  watchType: 'first-time' | 'rewatch';
  notes?: string;
}

export default function DiaryScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      loadDiary();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const loadDiary = async () => {
    try {
      const { data, error } = await supabase
        .from('watch_diary')
        .select(
          `
          id,
          title_id,
          watched_at,
          watch_type,
          notes,
          titles:title_id (
            title
          )
        `
        )
        .order('watched_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const formattedEntries: DiaryEntry[] = (data || []).map((entry: any) => ({
        id: entry.id,
        titleId: entry.title_id,
        titleName: entry.titles?.title || 'Unknown Title',
        watchedAt: entry.watched_at,
        watchType: entry.watch_type,
        notes: entry.notes,
      }));

      setEntries(formattedEntries);
    } catch (error) {
      console.error('Error loading diary:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView className="flex-1 bg-primary">
        <View className="flex-1 items-center justify-center p-4">
          <Text className="mb-4 text-xl font-bold text-text-primary">Watch Diary</Text>
          <Text className="mb-6 text-center text-text-secondary">Log in to track your viewing history</Text>
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
          title="Diary"
        />

        {entries.length === 0 ? (
          <View className="flex-1 items-center justify-center p-4">
            <Text className="text-center text-text-secondary">
              No diary entries yet. Start watching and rating titles to build your diary!
            </Text>
          </View>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View className="mb-2 border-b border-surface bg-surface p-4 rounded-lg">
                <TouchableOpacity onPress={() => router.push(`/title/${item.titleId}` as any)}>
                  <Text className="mb-1 text-lg font-semibold text-text-primary">{item.titleName}</Text>
                  <Text className="mb-2 text-sm text-text-secondary">
                    {format(new Date(item.watchedAt), 'MMM d, yyyy')} •{' '}
                    {item.watchType === 'first-time' ? 'First Time' : 'Rewatch'}
                  </Text>
                  {item.notes && <Text className="text-sm text-text-secondary">{item.notes}</Text>}
                </TouchableOpacity>
              </View>
            )}
            contentContainerStyle={{ padding: 8 }}
          />
        )}
      </View>
    </View>
  );
}
