import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { BlurView } from "expo-blur";
import { useEffect, useState } from "react";
import { dbService } from "~/services/database";
import type { Watchlist } from "~/types";
import { CreateWatchlistModal } from "./CreateWatchlistModal";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { TITLE_DATA_KEYS } from "~/hooks/data/useTitleData";

interface WatchlistSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  titleId: string;
}

export function WatchlistSelectorModal({
  visible,
  onClose,
  titleId,
}: WatchlistSelectorModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [selectedWatchlistIds, setSelectedWatchlistIds] = useState<Set<string>>(
    new Set(),
  );
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [lists, containingIds] = await Promise.all([
        dbService.getUserWatchlists(),
        dbService.getWatchlistsContainingTitle(titleId),
      ]);
      setWatchlists(lists);
      setSelectedWatchlistIds(new Set(containingIds));
    } catch (error) {
      console.error("Failed to load data", error);
      Alert.alert(t('common.error'), t('modals.failedToLoadWatchlists'));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWatchlist = async (watchlistId: string) => {
    if (togglingId) return; // Prevent double tap
    setTogglingId(watchlistId);

    const isSelected = selectedWatchlistIds.has(watchlistId);

    try {
      if (isSelected) {
        await dbService.removeFromWatchlist(watchlistId, titleId);
        const newSet = new Set(selectedWatchlistIds);
        newSet.delete(watchlistId);
        setSelectedWatchlistIds(newSet);
      } else {
        await dbService.addToWatchlist(watchlistId, titleId);
        const newSet = new Set(selectedWatchlistIds);
        newSet.add(watchlistId);
        setSelectedWatchlistIds(newSet);
      }

      // Invalidate the title user data to update the button status on the detail screen
      queryClient.invalidateQueries({
        queryKey: TITLE_DATA_KEYS.userData(titleId),
      });
    } catch (error: unknown) {
      console.error("Toggle error:", error);
      // Ignore unique violation if we tried to add but it was already there (sync issue)
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: unknown }).code !== "23505"
      ) {
        Alert.alert(t('common.error'), t('common.failedToUpdate'));
      } else if (!isSelected) {
        // If we tried to add and it failed because it exists, just update UI
        const newSet = new Set(selectedWatchlistIds);
        newSet.add(watchlistId);
        setSelectedWatchlistIds(newSet);
      }
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <BlurView
        intensity={20}
        className="flex-1 justify-center bg-black/50 px-6"
      >
        <View className="rounded-2xl bg-surface p-6 shadow-xl border border-white/10 max-h-[80%]">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-xl font-bold text-text-primary">
              {t('modals.addToWatchlist')}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              className="bg-surface rounded-full p-1"
            >
              <Ionicons name="close" size={20} color="#666" />
            </TouchableOpacity>
          </View>
          <Text className="text-text-secondary mb-6">
            {t('modals.watchlistSelectorHint')}
          </Text>

          {loading ? (
            <View className="py-8">
              <ActivityIndicator size="large" color="#1DB954" />
            </View>
          ) : (
            <ScrollView className="mb-4">
              {watchlists.length === 0 ? (
                <Text className="text-text-secondary text-center py-4">
                  {t('modals.noWatchlistsFound')}
                </Text>
              ) : (
                watchlists.map((list) => {
                  const isSelected = selectedWatchlistIds.has(list.id);
                  const isToggling = togglingId === list.id;

                  return (
                    <TouchableOpacity
                      key={list.id}
                      className="py-3 border-b border-white/5 flex-row justify-between items-center"
                      onPress={() => handleToggleWatchlist(list.id)}
                      disabled={isToggling}
                    >
                      <View className="flex-1 mr-4">
                        <Text
                          className={`font-medium text-lg ${isSelected ? "text-accent" : "text-text-primary"}`}
                        >
                          {list.name}
                        </Text>
                      </View>
                      {isToggling ? (
                        <ActivityIndicator size="small" color="#1DB954" />
                      ) : (
                        <Ionicons
                          name={
                            isSelected ? "checkmark-circle" : "ellipse-outline"
                          }
                          size={24}
                          color={isSelected ? "#1DB954" : "#666"}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          )}

          <TouchableOpacity
            className="py-3 items-center border-t border-white/10 mt-2 flex-row justify-center gap-2"
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={20} color="#1DB954" />
            <Text className="text-accent font-medium">
              {t('modals.createNewWatchlist')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onClose}
            className="mt-4 items-center py-3 bg-accent rounded-lg"
          >
            <Text className="text-white font-bold">{t('modals.done')}</Text>
          </TouchableOpacity>
        </View>
      </BlurView>

      <CreateWatchlistModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(newList) => {
          setWatchlists([newList, ...watchlists]);
          setShowCreateModal(false);
          // Automatically toggle ON for the new list
          handleToggleWatchlist(newList.id);
        }}
      />
    </Modal>
  );
}
