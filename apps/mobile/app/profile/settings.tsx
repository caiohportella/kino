import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native'
import { Picker } from '@react-native-picker/picker'
import { useRouter, Stack } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { dbService } from '~/services/database'
import * as ImagePicker from 'expo-image-picker'
import { MediaImageSelectorModal } from '~/components/modals/MediaImageSelectorModal'
import { useTranslation } from 'react-i18next'
import { changeLanguage } from '~/i18n'

export default function SettingsScreen() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [usernameError, setUsernameError] = useState('')

  const [showBannerModal, setShowBannerModal] = useState(false)
  const [showAvatarModal, setShowAvatarModal] = useState(false)

  const languages = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'pt', label: 'Português', flag: '🇧🇷' },
    { code: 'it', label: 'Italiano', flag: '🇮🇹' },
    { code: 'no', label: 'Norsk', flag: '🇳🇴' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
  ]

  useEffect(() => {
    loadProfile()
  }, [user?.id])

  const loadProfile = async () => {
    if (!user) return
    try {
      const profile = await dbService.getUserProfile(user.id)
      if (profile) {
        setDisplayName(profile.display_name || '')
        setBio(profile.bio || '')
        setAvatarUrl(profile.avatar_url)
        setBannerUrl(profile.banner_url || null)
        // Pre-fill username from profile or fallback to email part for display
        setUsername(profile.username || user.email?.split('@')[0] || '')
      } else {
        // If no profile exists yet, pre-fill from email
        setUsername(user.email?.split('@')[0] || '')
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadProfile()
  }, [user])

  const handleAvatarPress = () => {
    if (avatarUrl) {
      Alert.alert(t('settings.removeProfilePicture'), t('settings.removeProfilePictureConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: 'Change from Gallery', onPress: pickImage },
        { text: 'Choose from Media', onPress: () => setShowAvatarModal(true) },
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: () => setAvatarUrl(null),
        },
      ])
    } else {
      Alert.alert('Change Profile Picture', 'Choose an option', [
        { text: t('common.cancel'), style: 'cancel' },
        { text: 'Gallery', onPress: pickImage },
        { text: 'From Media', onPress: () => setShowAvatarModal(true) },
      ])
    }
  }

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (!result.canceled) {
      setAvatarUrl(result.assets[0].uri)
    }
  }

  const handleSave = async () => {
    if (!user) return

    // Reset error
    setUsernameError('')

    // Validation
    const trimmedUsername = username.trim()
    if (trimmedUsername.length < 3) {
      setUsernameError(t('settings.usernameMinLength'))
      return
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      setUsernameError(t('settings.usernameInvalidChars'))
      return
    }

    setSaving(true)
    try {
      let finalAvatarUrl = avatarUrl

      // Upload image if it's a local URI (not http)
      if (avatarUrl && !avatarUrl.startsWith('http')) {
        const uploadedUrl = await dbService.uploadAvatar(avatarUrl)
        if (uploadedUrl) {
          finalAvatarUrl = uploadedUrl
        }
      }

      await dbService.updateUserProfile(user.id, {
        display_name: displayName,
        bio,
        avatar_url: finalAvatarUrl,
        banner_url: bannerUrl,
        username: trimmedUsername,
      })

      Alert.alert(t('settings.success'), t('settings.profileUpdated'))
      router.back()
    } catch (error: unknown) {
      console.error('Profile update error:', error)
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: unknown }).code === '23505' &&
        'message' in error &&
        typeof (error as { message: unknown }).message === 'string' &&
        (error as { message: string }).message.includes('user_profiles_username_key')
      ) {
        setUsernameError(t('settings.usernameTaken'))
      } else {
        Alert.alert(t('common.error'), t('common.failedToUpdate'))
      }
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    Alert.alert(t('settings.logout'), t('settings.logoutConfirm'), [
      {
        text: t('common.cancel'),
        style: 'cancel',
      },
      {
        text: t('settings.logout'),
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut()
            router.replace('/(auth)/login')
          } catch (error) {
            console.error('Logout failed:', error)
            Alert.alert(t('common.error'), t('common.failed'))
          }
        },
      },
    ])
  }

  const handleDeleteAccount = async () => {
    Alert.alert(t('settings.deleteAccountTitle'), t('settings.deleteAccountConfirm'), [
      {
        text: t('common.cancel'),
        style: 'cancel',
      },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          setLoading(true)
          try {
            await dbService.deleteUserAccount()
            await signOut()
            router.replace('/(auth)/login')
          } catch (error) {
            console.error('Delete account failed:', error)
            Alert.alert(t('common.error'), t('common.tryAgain'))
            setLoading(false)
          }
        },
      },
    ])
  }

  const handleDeleteData = async () => {
    Alert.alert(t('settings.deleteDataTitle'), t('settings.deleteDataConfirm'), [
      {
        text: t('common.cancel'),
        style: 'cancel',
      },
      {
        text: t('settings.deleteData'),
        style: 'destructive',
        onPress: async () => {
          setLoading(true)
          try {
            await dbService.deleteUserData()
            Alert.alert(t('settings.success'), t('settings.dataDeleted'))
          } catch (error) {
            console.error('Delete data failed:', error)
            Alert.alert(t('common.error'), t('common.tryAgain'))
          } finally {
            setLoading(false)
          }
        },
      },
    ])
  }

  if (loading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-primary items-center justify-center">
        <ActivityIndicator size="large" color="#1DB954" />
      </SafeAreaView>
    )
  }

  return (
    <View className="flex-1 bg-primary">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: t('settings.editProfile'),
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#121212' },
          headerTintColor: '#fff',
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          headerRight: () => (
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              className="items-center justify-center w-8 h-8 ml-1.5"
            >
              {saving ? (
                <ActivityIndicator size="small" color="#1DB954" />
              ) : (
                <Ionicons name="save-outline" size={24} color="#1DB954" />
              )}
            </TouchableOpacity>
          ),
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#1DB954"
              colors={['#1DB954']}
            />
          }
        >
          {refreshing && (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color="#1DB954" />
            </View>
          )}
          {/* Banner Section */}
          <TouchableOpacity
            className="h-48 w-full bg-surface relative items-center justify-center"
            onPress={() => setShowBannerModal(true)}
          >
            {bannerUrl ? (
              <Image source={{ uri: bannerUrl }} className="w-full h-full" resizeMode="cover" />
            ) : (
              <View className="items-center">
                <Ionicons name="image-outline" size={32} color="#666" />
                <Text className="text-text-secondary mt-2">Tap to set banner</Text>
              </View>
            )}
            <View className="absolute bottom-2 right-2 bg-black/50 p-2 rounded-full">
              <Ionicons name="pencil" size={16} color="#FFF" />
            </View>
          </TouchableOpacity>

          {/* Avatar Section */}
          <View className="items-center -mt-12 mb-6">
            <TouchableOpacity className="relative" onPress={handleAvatarPress}>
              <View className="h-24 w-24 rounded-full border-4 border-primary bg-surface overflow-hidden items-center justify-center">
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} className="w-full h-full" />
                ) : (
                  <Ionicons name="person" size={40} color="#666" />
                )}
              </View>
              <View
                className={`absolute bottom-0 right-0 p-2 rounded-full border-2 border-primary ${avatarUrl ? 'bg-red-500' : 'bg-accent'}`}
              >
                <Ionicons name={avatarUrl ? 'trash' : 'camera'} size={14} color="#FFF" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View className="px-4 space-y-4">
            <View className="mb-4">
              <Text className="text-text-secondary text-sm mb-2 uppercase font-bold tracking-wider">
                {t('settings.displayName')}
              </Text>
              <TextInput
                className="bg-surface text-text-primary p-4 rounded-lg border border-white/5"
                placeholder="Your Name"
                placeholderTextColor="#666"
                value={displayName}
                onChangeText={setDisplayName}
              />
            </View>

            <View className="mb-4">
              <Text className="text-text-secondary text-sm mb-2 uppercase font-bold tracking-wider">
                {t('settings.username')}
              </Text>
              <TextInput
                className={`bg-surface text-text-primary p-4 rounded-lg border ${usernameError ? 'border-red-500' : 'border-white/5'}`}
                placeholder="username"
                placeholderTextColor="#666"
                value={username}
                onChangeText={(text) => {
                  setUsername(text)
                  if (usernameError) setUsernameError('')
                }}
                autoCapitalize="none"
              />
              {usernameError ? (
                <Text className="text-red-500 text-sm mt-1">{usernameError}</Text>
              ) : null}
            </View>

            <View className="mb-4">
              <Text className="text-text-secondary text-sm mb-2 uppercase font-bold tracking-wider">
                {t('settings.bio')}
              </Text>
              <TextInput
                className="bg-surface text-text-primary p-4 rounded-lg border border-white/5 h-24"
                placeholder="Tell us about yourself..."
                placeholderTextColor="#666"
                value={bio}
                onChangeText={setBio}
                multiline
                textAlignVertical="top"
              />
            </View>
            <View className="mb-4">
              <Text className="text-text-secondary text-sm mb-2 uppercase font-bold tracking-wider">
                {t('settings.language')}
              </Text>
              <View className="bg-surface rounded-lg border border-white/5 overflow-hidden">
                <Picker
                  selectedValue={i18n.language}
                  onValueChange={(value) => changeLanguage(value)}
                  dropdownIconColor="#666"
                  style={{
                    color: '#fff',
                    backgroundColor: 'transparent',
                  }}
                >
                  {languages.map((lang) => (
                    <Picker.Item
                      key={lang.code}
                      label={`${lang.flag} ${lang.label}`}
                      value={lang.code}
                      color={Platform.OS === 'ios' ? '#fff' : '#000'}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            <View className="mb-4">
              <Text className="text-text-secondary text-sm mb-2 uppercase font-bold tracking-wider">
                {t('settings.import')}
              </Text>
              <TouchableOpacity
                className="bg-surface border border-white/5 rounded-lg p-4 flex-row items-center justify-between"
                onPress={() => router.push('/profile/import')}
              >
                <View className="flex-1 pr-3">
                  <Text className="text-text-primary font-semibold text-base">
                    {t('settings.importHistoryTitle')}
                  </Text>
                  <Text className="text-text-secondary text-sm mt-1">
                    {t('settings.importHistorySubtitle')}
                  </Text>
                </View>
                <Ionicons name="cloud-upload-outline" size={22} color="#1DB954" />
              </TouchableOpacity>
            </View>
          </View>

          <View className="px-4 mt-8">
            <TouchableOpacity
              className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg items-center justify-center flex-row space-x-2"
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text className="text-red-500 font-bold text-base ml-2">{t('settings.logout')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="mt-4 bg-orange-500/10 border border-orange-500/50 p-4 rounded-lg items-center justify-center flex-row space-x-2"
              onPress={handleDeleteData}
            >
              <Ionicons name="trash-outline" size={20} color="#F97316" />
              <Text className="text-orange-500 font-bold text-base ml-2">
                {t('settings.deleteData')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="mt-4 p-4 rounded-lg items-center justify-center flex-row space-x-2"
              onPress={handleDeleteAccount}
            >
              <Text className="text-red-500/70 font-semibold text-sm">
                {t('settings.deleteAccount')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <MediaImageSelectorModal
        visible={showBannerModal}
        onClose={() => setShowBannerModal(false)}
        onSelectImage={setBannerUrl}
        imageType="banner"
      />
      <MediaImageSelectorModal
        visible={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        onSelectImage={setAvatarUrl}
        imageType="avatar"
      />
    </View>
  )
}
