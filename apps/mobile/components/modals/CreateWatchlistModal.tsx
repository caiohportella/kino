import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { useState, useEffect } from 'react'
import { dbService } from '~/services/database'
import { useTranslation } from 'react-i18next'
import type { Watchlist } from '~/types'

interface CreateWatchlistModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: (watchlist: Watchlist) => void
  initialValues?: Watchlist
}

export function CreateWatchlistModal({
  visible,
  onClose,
  onSuccess,
  initialValues,
}: CreateWatchlistModalProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isShared, setIsShared] = useState(false)
  const [shareCode, setShareCode] = useState('')
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [loading, setLoading] = useState(false)

  // Initialize/Reset form when opening
  useEffect(() => {
    if (visible) {
      setMode('create')
      setShareCode('')
      if (initialValues) {
        setName(initialValues.name)
        setDescription(initialValues.description || '')
        setIsShared(initialValues.isShared)
      } else {
        setName('')
        setDescription('')
        setIsShared(false)
      }
    }
  }, [visible, initialValues])

  const handleSubmit = async () => {
    if (mode === 'join') {
      if (!shareCode.trim()) {
        Alert.alert(t('common.error'), t('modals.enterShareCode'))
        return
      }

      setLoading(true)
      try {
        const result = await dbService.joinWatchlistByCode(shareCode.trim())
        Alert.alert(t('settings.success'), t('modals.joinedSuccessfully'))
        onSuccess(result)
      } catch (error: unknown) {
        console.error('Join Watchlist Error:', error)
        const message = error instanceof Error ? error.message : t('modals.failedToJoin')
        Alert.alert(t('common.error'), message)
      } finally {
        setLoading(false)
      }
      return
    }

    if (!name.trim()) {
      Alert.alert(t('common.error'), t('modals.enterName'))
      return
    }

    setLoading(true)
    try {
      let result: Watchlist
      if (initialValues) {
        // Edit mode
        result = await dbService.updateWatchlist(initialValues.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          isShared,
        })
      } else {
        // Create mode
        result = await dbService.createWatchlist(
          name.trim(),
          description.trim() || undefined,
          undefined, // thumbnail
          isShared
        )
      }
      onSuccess(result)
    } catch (error: unknown) {
      console.error('Watchlist Error:', error)
      const message = error instanceof Error ? error.message : t('common.failedToSave')
      Alert.alert(t('common.error'), message)
    } finally {
      setLoading(false)
    }
  }

  const isEditMode = !!initialValues

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={20} className="flex-1 justify-center bg-black/50 px-6">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View className="rounded-2xl bg-surface p-6 shadow-xl border border-white/10">
            <Text className="text-xl font-bold text-text-primary mb-6">
              {isEditMode
                ? t('modals.editWatchlist')
                : mode === 'join'
                  ? t('modals.joinWatchlist')
                  : t('modals.newWatchlist')}
            </Text>

            {!isEditMode && (
              <View className="flex-row bg-black/30 p-1 rounded-lg mb-6">
                <TouchableOpacity
                  className={`flex-1 py-2 items-center rounded-md ${mode === 'create' ? 'bg-white/10' : ''}`}
                  onPress={() => setMode('create')}
                >
                  <Text
                    className={`font-semibold ${mode === 'create' ? 'text-white' : 'text-text-secondary'}`}
                  >
                    {t('modals.createNew')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 py-2 items-center rounded-md ${mode === 'join' ? 'bg-white/10' : ''}`}
                  onPress={() => setMode('join')}
                >
                  <Text
                    className={`font-semibold ${mode === 'join' ? 'text-white' : 'text-text-secondary'}`}
                  >
                    {t('modals.joinExisting')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {mode === 'join' ? (
              <View className="mb-4">
                <Text className="text-text-secondary mb-2 text-sm">{t('modals.shareCode')}</Text>
                <TextInput
                  className="bg-black/30 text-text-primary p-3 rounded-lg border border-white/10"
                  placeholder={t('modals.enterCode')}
                  placeholderTextColor="#666"
                  value={shareCode}
                  onChangeText={(text) => setShareCode(text.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={8}
                />
                <Text className="text-text-secondary text-xs mt-2">
                  {t('modals.shareCodeHint')}
                </Text>
              </View>
            ) : (
              <>
                <View className="mb-4">
                  <Text className="text-text-secondary mb-2 text-sm">{t('modals.name')}</Text>
                  <TextInput
                    className="bg-black/30 text-text-primary p-3 rounded-lg border border-white/10"
                    placeholder={t('modals.namePlaceholder')}
                    placeholderTextColor="#666"
                    value={name}
                    onChangeText={setName}
                    autoFocus={!isEditMode}
                  />
                </View>

                <View className="mb-4">
                  <Text className="text-text-secondary mb-2 text-sm">
                    {t('modals.descriptionOptional')}
                  </Text>
                  <TextInput
                    className="bg-black/30 text-text-primary p-3 rounded-lg border border-white/10"
                    placeholder={t('modals.descriptionPlaceholder')}
                    placeholderTextColor="#666"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={3}
                    style={{ textAlignVertical: 'top' }}
                  />
                </View>

                <View className="mb-6 flex-row items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5">
                  <View className="flex-1 mr-4">
                    <Text className="text-text-primary font-medium mb-1">
                      {t('modals.makeShared')}
                    </Text>
                    <Text className="text-text-secondary text-xs">{t('modals.shareHint')}</Text>
                  </View>
                  <Switch
                    value={isShared}
                    onValueChange={setIsShared}
                    trackColor={{ false: '#333', true: '#1DB954' }}
                    thumbColor={isShared ? '#fff' : '#f4f3f4'}
                  />
                </View>
              </>
            )}

            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 py-3 rounded-lg bg-surface border border-white/10 items-center"
                onPress={onClose}
                disabled={loading}
              >
                <Text className="text-text-secondary font-semibold">{t('common.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 py-3 rounded-lg bg-accent items-center"
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text className="text-primary font-bold">
                    {isEditMode
                      ? t('common.save')
                      : mode === 'join'
                        ? t('modals.join')
                        : t('modals.create')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>
  )
}
