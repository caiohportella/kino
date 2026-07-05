import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { RatingStars } from '../common/RatingStars'
import { useEffect, useState, useMemo } from 'react'
import { Ionicons } from '@expo/vector-icons'
import type { TMDbEpisode, EpisodeRating } from '~/types'
import { useTranslation } from 'react-i18next'

interface SeasonRatingModalProps {
  visible: boolean
  onClose: () => void
  seasonNumber: number
  episodes: TMDbEpisode[]
  ratings: Record<string, EpisodeRating>
  onRateEpisode: (
    episodeNumber: number,
    rating: number,
    watchType: 'first-time' | 'rewatch'
  ) => Promise<void>
  onRateSeason: (rating: number) => Promise<void>
}

export function SeasonRatingModal({
  visible,
  onClose,
  seasonNumber,
  episodes,
  ratings,
  onRateEpisode,
  onRateSeason,
}: SeasonRatingModalProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [seasonRating, setSeasonRating] = useState(0)
  const [individualRatings, setIndividualRatings] = useState<Record<number, number>>({})

  const { ratedPercentage, episodesToRate } = useMemo(() => {
    if (!episodes || episodes.length === 0) {
      return { ratedPercentage: 0, episodesToRate: [] }
    }
    const ratedEpisodesCount = Object.values(ratings).filter((r) => r.rating && r.rating > 0).length
    const percentage = (ratedEpisodesCount / episodes.length) * 100
    const toRate = episodes.filter((ep) => !ratings[ep.episode_number]?.rating)
    return { ratedPercentage: percentage, episodesToRate: toRate }
  }, [episodes, ratings])

  useEffect(() => {
    if (visible) {
      setLoading(false)
      setSeasonRating(0)
      setIndividualRatings({})
    }
  }, [visible])

  const handleSaveIndividualRatings = async () => {
    setLoading(true)
    try {
      const promises = Object.entries(individualRatings).map(([episodeNumber, rating]) => {
        const originalRating = ratings[episodeNumber]
        return onRateEpisode(
          parseInt(episodeNumber, 10),
          rating,
          originalRating?.watchType || 'first-time'
        )
      })
      await Promise.all(promises)
      onClose()
    } catch (error) {
      console.error('Error saving individual ratings', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRateSeason = async () => {
    if (seasonRating === 0) {
      onClose()
      return
    }
    setLoading(true)
    try {
      await onRateSeason(seasonRating)
      onClose()
    } catch (error) {
      console.error('Error rating season', error)
    } finally {
      setLoading(false)
    }
  }

  const renderContent = () => {
    if (ratedPercentage >= 75 && ratedPercentage < 100) {
      return (
        <>
          <Text className="mb-4 text-center text-text-secondary">
            {t('modals.seasonRatingModal.rateRemainingPrompt')}
          </Text>
          <ScrollView style={{ maxHeight: 250 }}>
            {episodesToRate.map((ep) => (
              <View key={ep.id} className="mb-3 flex-row items-center justify-between">
                <Text className="flex-1 text-text-primary" numberOfLines={1}>
                  {`E${ep.episode_number} - ${ep.name}`}
                </Text>
                <RatingStars
                  rating={individualRatings[ep.episode_number] || 0}
                  onRatingChange={(r) =>
                    setIndividualRatings((prev) => ({
                      ...prev,
                      [ep.episode_number]: r,
                    }))
                  }
                  size={20}
                />
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity
            onPress={handleSaveIndividualRatings}
            disabled={loading}
            className="mt-4 h-[48px] items-center justify-center rounded-full bg-accent py-3"
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="font-semibold text-primary">
                {t('modals.seasonRatingModal.saveRatings')}
              </Text>
            )}
          </TouchableOpacity>
        </>
      )
    }

    return (
      <>
        <Text className="mb-6 text-text-secondary">
          {t('modals.seasonRatingModal.setSeasonScorePrompt')}
        </Text>
        <View className="mb-8 items-center">
          <RatingStars
            rating={seasonRating}
            onRatingChange={setSeasonRating}
            size={40}
            showValue={false}
          />
        </View>
        <TouchableOpacity
          onPress={handleRateSeason}
          disabled={loading}
          className="h-[48px] items-center justify-center rounded-full bg-accent py-3"
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="font-semibold text-primary">
              {seasonRating > 0 ? t('modals.seasonRatingModal.rateSeason') : t('common.cancel')}
            </Text>
          )}
        </TouchableOpacity>
      </>
    )
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <BlurView intensity={20} className="flex-1 justify-center bg-black/50 px-6">
          <TouchableWithoutFeedback>
            <View className="rounded-2xl border border-white/10 bg-surface p-6 shadow-xl">
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-xl font-bold text-text-primary">
                  {t('modals.seasonRatingModal.title', { seasonNumber })}
                </Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close-circle" size={24} color="#888" />
                </TouchableOpacity>
              </View>
              {renderContent()}
            </View>
          </TouchableWithoutFeedback>
        </BlurView>
      </TouchableWithoutFeedback>
    </Modal>
  )
}
