import { Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { usePersonData } from '~/hooks/usePersonData'
import { useRouter } from 'expo-router'
import { FlatList } from 'react-native-gesture-handler'
import type { TMDbPersonCredit } from '~/types'
import { getTMDbService } from '~/services/tmdb'
import { TitleCard } from '~/components/common/TitleCard'

interface PersonalityModalProps {
  visible: boolean
  onClose: () => void
  personId: number | null
}

export function PersonalityModal({ visible, onClose, personId }: PersonalityModalProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const tmdb = getTMDbService()

  const { data: person, isLoading, error } = usePersonData(personId)

  // Deduplicate and short credits by popularity/vote count
  const knownFor =
    person?.combined_credits.cast
      .filter(
        (credit, index, self) =>
          index === self.findIndex((t) => t.id === credit.id && t.media_type === credit.media_type)
      )
      .sort((a, b) => b.vote_count - a.vote_count) || []

  // Get a backdrop from the most popular movie/show they've been in
  const backdropCredit = knownFor.find(c => c.backdrop_path)
  const backdropUrl = backdropCredit ? tmdb.getBackdropUrl(backdropCredit.backdrop_path, 'w780') : null

  const handleTitlePress = (credit: TMDbPersonCredit) => {
    onClose()
    // Small delay to allow modal to close smoothly before navigating
    setTimeout(() => {
      router.push(`/title/${credit.id}?type=${credit.media_type || 'movie'}`)
    }, 300)
  }

  const renderKnownForItem = ({ item }: { item: TMDbPersonCredit }) => {
    return (
      <View className="w-36 mr-4">
        <TitleCard title={item} onPress={() => handleTitlePress(item)} />
        {item.character && (
          <Text className="mt-2 text-xs text-center text-text-secondary" numberOfLines={1}>
            {item.character}
          </Text>
        )}
      </View>
    )
  }

  const openSocialLink = (url: string) => {
    Linking.openURL(url).catch(err => console.error("Couldn't load page", err))
  }

  return (
    <Modal
      animationType="slide"
      presentationStyle="pageSheet"
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-primary">
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#1DB954" />
          </View>
        ) : error || !person ? (
          <View className="flex-1 items-center justify-center p-6">
            <Text className="text-center text-text-secondary">
              {t('person.errorLoading', 'Failed to load details.')}
            </Text>
          </View>
        ) : (
          <ScrollView className="flex-1" bounces={false}>
            {/* Hero Section */}
            <View className="relative">
              {backdropUrl ? (
                <Image
                  source={{ uri: backdropUrl }}
                  className="h-48 w-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="h-48 w-full items-center justify-center bg-surface">
                  <Ionicons name="image-outline" size={48} color="#B0B0B0" />
                </View>
              )}
              <View className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-primary to-transparent" />
            </View>

            {/* Profile Header (Overlapping Hero) */}
            <View className="-mt-12 mb-6 flex-row items-end px-4">
              {person.profile_path ? (
                <Image
                  source={{ uri: tmdb.getImageUrl(person.profile_path, 'w300') || '' }}
                  className="mr-4 h-36 w-24 rounded-lg border-2 border-white shadow-md bg-surface"
                  resizeMode="cover"
                />
              ) : (
                <View className="mr-4 h-36 w-24 items-center justify-center rounded-lg border-2 border-white bg-surface shadow-md">
                  <Ionicons name="person-outline" size={40} color="#666" />
                </View>
              )}
              <View className="flex-1 pb-2">
                <Text className="text-2xl font-bold text-text-primary" numberOfLines={2}>
                  {person.name}
                </Text>

                {/* Social Links */}
                {person.external_ids && (
                  <View className="flex-row flex-wrap gap-3 mt-2">
                    {person.external_ids.instagram_id && (
                      <TouchableOpacity onPress={() => openSocialLink(`https://instagram.com/${person.external_ids!.instagram_id}`)}>
                        <Ionicons name="logo-instagram" size={20} color="#E1306C" />
                      </TouchableOpacity>
                    )}
                    {person.external_ids.twitter_id && (
                      <TouchableOpacity onPress={() => openSocialLink(`https://x.com/${person.external_ids!.twitter_id}`)}>
                        <Ionicons name="logo-x" size={20} color="#1DA1F2" />
                      </TouchableOpacity>
                    )}
                    {person.external_ids.facebook_id && (
                      <TouchableOpacity onPress={() => openSocialLink(`https://facebook.com/${person.external_ids!.facebook_id}`)}>
                        <Ionicons name="logo-facebook" size={20} color="#1877F2" />
                      </TouchableOpacity>
                    )}
                    {person.external_ids.tiktok_id && (
                      <TouchableOpacity onPress={() => openSocialLink(`https://tiktok.com/@${person.external_ids!.tiktok_id}`)}>
                        <Ionicons name="logo-tiktok" size={20} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                    {person.external_ids.imdb_id && (
                      <TouchableOpacity onPress={() => openSocialLink(`https://imdb.com/name/${person.external_ids!.imdb_id}`)}>
                        <Ionicons name="film-outline" size={20} color="#F5C518" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>

            {/* Info Details Container */}
            <View className="px-6 mb-6">
              <View className="flex-row flex-wrap gap-x-6 gap-y-3 mb-4">
                {(person.birthday) && (
                  <View className="flex-row items-center">
                    <Ionicons name="star" size={14} color="#1DB954" className="mr-1" />
                    <Text className="text-sm text-text-primary font-medium ml-1">
                      {new Date(person.birthday).toLocaleDateString()}
                    </Text>
                  </View>
                )}
                {(person.deathday) && (
                  <View className="flex-row items-center">
                    <Ionicons name="skull-outline" size={16} color="#FF4B4B" className="mr-1" />
                    <Text className="text-sm text-text-primary font-medium ml-1">
                      {new Date(person.deathday).toLocaleDateString()}
                    </Text>
                  </View>
                )}
                {person.place_of_birth && (
                  <View className="flex-row items-center">
                    <Ionicons name="location-outline" size={14} color="#666" className="mr-1" />
                    <Text className="text-sm text-text-primary font-medium ml-1">
                      {person.place_of_birth}
                    </Text>
                  </View>
                )}
                {person.known_for_department && (
                  <View className="flex-row items-center bg-surface px-2 py-1 rounded">
                    <Text className="text-xs text-text-secondary font-medium">
                      {t(`person.department.${person.known_for_department}`, { defaultValue: person.known_for_department })}
                    </Text>
                  </View>
                )}
              </View>

              {person.biography ? (
                <View className="mb-8">
                  <Text className="mb-2 text-lg font-bold text-text-primary">
                    {t('person.biography')}
                  </Text>
                  <Text className="text-sm leading-6 text-text-secondary">
                    {person.biography}
                  </Text>
                </View>
              ) : null}
            </View>

            {knownFor.length > 0 && (
              <View className="pl-6 mb-8">
                <Text className="mb-3 text-lg font-bold text-text-primary">
                  {t('person.knownFor')}
                </Text>
                <FlatList
                  horizontal
                  data={knownFor}
                  renderItem={renderKnownForItem}
                  keyExtractor={(item) => `${item.id}-${item.media_type}`}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingRight: 24 }}
                />
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  )
}

