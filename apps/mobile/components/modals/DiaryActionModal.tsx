import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
  Switch,
  TouchableWithoutFeedback,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { RatingStars } from '../common/RatingStars'
import { useEffect, useState, useCallback } from 'react'
import DateTimePicker from '@react-native-community/datetimepicker'
import { dbService } from '~/services/database'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@kino/core'

import { UIDiaryEntry } from '~/types'

interface DiaryActionModalProps {
  visible: boolean
  onClose: () => void
  entry: UIDiaryEntry | null
  onUpdate: () => void
}

export function DiaryActionModal({ visible, onClose, entry, onUpdate }: DiaryActionModalProps) {
  const { t } = useTranslation()
  const language = useLanguage()
  const [rating, setRating] = useState(0)
  const [watchedAt, setWatchedAt] = useState(new Date())
  const [watchType, setWatchType] = useState<'first-time' | 'rewatch'>('first-time')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [loading, setLoading] = useState(false)

  const isMovie = entry?.type === 'movie'

  const loadRating = useCallback(async () => {
    if (!entry || !isMovie) {
      setRating(0)
      return
    }
    const userRating = await dbService.getUserRating(entry.titleId)
    setRating(userRating?.rating || 0)
  }, [entry, isMovie])

  useEffect(() => {
    if (visible && entry) {
      setWatchedAt(new Date(entry.watchedAt))
      setWatchType(entry.watchType)
      loadRating()
    } else if (!visible) {
      setRating(0) // Reset rating when modal is closed
    }
  }, [visible, entry, loadRating])

  const handleDelete = () => {
    if (!entry) return
    Alert.alert(t('modals.deleteEntry'), t('modals.deleteEntryConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          setLoading(true)
          try {
            await dbService.deleteWatchDiaryEntry(entry.id)
            onUpdate()
            onClose()
          } catch (error) {
            Alert.alert(t('common.error'), t('common.failedToDelete'))
          } finally {
            setLoading(false)
          }
        },
      },
    ])
  }

  const handleSave = async () => {
    if (!entry) return
    setLoading(true)
    try {
      // Update Diary Entry
      await dbService.updateWatchDiaryEntry(entry.id, {
        watchedAt,
        watchType,
      })

      // Update Rating - only for movies
      if (isMovie) {
        if (rating === 0) {
          await dbService.deleteTitleRating(entry.titleId)
        } else {
          await dbService.rateTitle(entry.titleId, rating, watchType, watchedAt)
        }
      }

      onUpdate()
      onClose()
    } catch (error) {
      Alert.alert(t('common.error'), t('common.failedToUpdate'))
    } finally {
      setLoading(false)
    }
  }

  if (!entry) return null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <BlurView intensity={20} className="flex-1 justify-center bg-black/50 px-6">
          <TouchableWithoutFeedback>
            <View className="rounded-2xl border border-white/10 bg-surface p-6 shadow-xl">
              <View className="mb-4 flex-row items-start justify-between">
                <View className="mr-4 flex-1">
                  <Text className="text-xl font-bold text-text-primary" numberOfLines={2}>
                    {entry.titleName}
                  </Text>
                  <Text className="text-sm text-text-secondary">{t('modals.editEntry')}</Text>
                </View>
                <TouchableOpacity onPress={handleDelete} className="rounded-full bg-red-500/10 p-2">
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>

              <View className="mb-6">
                <Text className="mb-2 text-xs font-bold uppercase text-text-secondary">
                  {t('modals.watchedOn')}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  className="flex-row items-center justify-between rounded-lg border border-white/10 bg-black/20 p-3"
                >
                  <Text className="text-base text-text-primary">
                    {formatDate(watchedAt)}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color="#1DB954" />
                </TouchableOpacity>
              </View>

              {showDatePicker &&
                (Platform.OS === 'ios' ? (
                  <Modal
                    visible={showDatePicker}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowDatePicker(false)}
                  >
                    <BlurView intensity={20} className="flex-1 justify-center bg-black/50 px-4">
                      <View className="rounded-2xl border border-white/10 bg-surface p-2 shadow-xl">
                        <DateTimePicker
                          value={watchedAt}
                          mode="date"
                          display="inline"
                          onChange={(e, selectedDate) => {
                            if (selectedDate) setWatchedAt(selectedDate)
                          }}
                          themeVariant="dark"
                          accentColor="#1DB954"
                          locale={language}
                        />
                        <TouchableOpacity
                          className="mt-2 items-center rounded-lg border-t border-white/10 bg-accent/10 p-3"
                          onPress={() => setShowDatePicker(false)}
                        >
                          <Text className="font-bold text-accent">{t('modals.done')}</Text>
                        </TouchableOpacity>
                      </View>
                    </BlurView>
                  </Modal>
                ) : (
                  <DateTimePicker
                    value={watchedAt}
                    mode="date"
                    display="default"
                    onChange={(e, selectedDate) => {
                      setShowDatePicker(false)
                      if (selectedDate) setWatchedAt(selectedDate)
                    }}
                    locale={language}
                  />
                ))}

              {/* Rating Section */}
              {isMovie && (
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
              )}

              {/* Watch Type Selector */}
              <View className="mb-8 flex-row items-center justify-between">
                {watchType === 'rewatch' ? (
                  <View className="flex-row items-center gap-2 space-x-2 rounded-full border border-green-500 bg-green-500/20 px-2 py-1 shadow-lg shadow-green-500/50">
                    <Ionicons name="refresh-circle" size={16} color="#1DB954" />
                    <Text className="font-bold text-green-400">{t('modals.rewatched')}</Text>
                  </View>
                ) : (
                  <Text className="font-medium text-text-secondary">{t('modals.isRewatch')}</Text>
                )}
                <Switch
                  value={watchType === 'rewatch'}
                  onValueChange={(value) => setWatchType(value ? 'rewatch' : 'first-time')}
                  trackColor={{ false: '#767577', true: '#1DB954' }}
                  thumbColor={'#f4f3f4'}
                  ios_backgroundColor="#3e3e3e"
                />
              </View>

              {/* Actions */}
              <View className="mb-2">
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={loading}
                  className={`items-center rounded-full bg-accent py-3 ${loading ? 'opacity-50' : ''
                    }`}
                >
                  <Text className="font-semibold text-primary">{t('modals.saveChanges')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </BlurView>
      </TouchableWithoutFeedback>
    </Modal>
  )
}
