import { Modal, View, Text, TouchableOpacity, Switch, TouchableWithoutFeedback } from 'react-native'
import { WatchlistSelectorModal } from './WatchlistSelectorModal'
import { BlurView } from 'expo-blur'
import { RatingStars } from '../common/RatingStars'
import { useEffect, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

interface EpisodeActionModalProps {
  visible: boolean
  onClose: () => void
  episodeNumber: number
  seasonNumber: number
  titleId: string
  initialRating?: number
  initialWatchType?: 'first-time' | 'rewatch'
  onRate: (rating: number | null, watchType: 'first-time' | 'rewatch') => Promise<void>
  onAddToDiary?: (rating: number | null, watchType: 'first-time' | 'rewatch') => Promise<void>
}

export function EpisodeActionModal({
  visible,
  onClose,
  episodeNumber,
  seasonNumber,
  titleId,
  initialRating = 0,
  initialWatchType = 'first-time',
  onRate,
}: EpisodeActionModalProps) {
  const { t } = useTranslation()
  const [rating, setRating] = useState(initialRating)
  const [watchType, setWatchType] = useState<'first-time' | 'rewatch'>(initialWatchType)
  const [showWatchlistModal, setShowWatchlistModal] = useState(false)

  useEffect(() => {
    if (visible) {
      setRating(initialRating)
      setWatchType(initialWatchType)
    }
  }, [visible, initialRating, initialWatchType])

  const handleWatched = async () => {
    // Allow rating to be 0 (interpreted as null/no rating)
    await onRate(rating === 0 ? null : rating, watchType)
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <BlurView intensity={20} className="flex-1 justify-center bg-black/50 px-6">
          <TouchableWithoutFeedback>
            <View className="rounded-2xl border border-white/10 bg-surface p-6 shadow-xl">
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-xl font-bold text-text-primary">
                  {t('modals.episodeActionModal.title', {
                    seasonNumber,
                    episodeNumber,
                  })}
                </Text>
              </View>
              <Text className="mb-6 text-text-secondary">
                {t('modals.episodeActionModal.subtitle')}
              </Text>

              {/* Rating Section */}
              <View className="mb-8 items-center">
                <RatingStars
                  rating={rating}
                  onRatingChange={setRating}
                  size={40}
                  showValue={false}
                />
                {rating === 0 && (
                  <Text className="mt-2 text-sm text-text-secondary">{t('modals.optional')}</Text>
                )}
              </View>

              {/* Watch Type Selector */}
              <View className="mb-8 flex-row items-center justify-between">
                {watchType === 'rewatch' ? (
                  <View className="flex-row items-center gap-2 space-x-2 rounded-full border border-green-500 bg-green-500/20 px-2 py-1 shadow-lg shadow-green-500/50">
                    <Ionicons name="refresh-circle" size={16} color="#1DB954" />
                    <Text className="font-bold text-green-400">{t('modals.rewatched')}</Text>
                  </View>
                ) : (
                  <Text className="font-medium text-text-secondary">
                    {t('modals.episodeActionModal.isRewatch')}
                  </Text>
                )}
                <Switch
                  value={watchType === 'rewatch'}
                  onValueChange={(value) => setWatchType(value ? 'rewatch' : 'first-time')}
                  trackColor={{ false: '#767577', true: '#1DB954' }}
                  thumbColor={watchType === 'rewatch' ? '#f4f3f4' : '#f4f3f4'}
                  ios_backgroundColor="#3e3e3e"
                />
              </View>

              {/* Actions */}
              <View className="mb-4">
                <TouchableOpacity
                  onPress={handleWatched}
                  className="items-center rounded-full bg-accent py-3"
                >
                  <Text className="font-semibold text-primary">
                    {rating > 0
                      ? t('modals.episodeActionModal.rateAndMarkWatched')
                      : t('modals.markWatched')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </BlurView>
      </TouchableWithoutFeedback>

      <WatchlistSelectorModal
        visible={showWatchlistModal}
        onClose={() => setShowWatchlistModal(false)}
        titleId={titleId}
      />
    </Modal>
  )
}
