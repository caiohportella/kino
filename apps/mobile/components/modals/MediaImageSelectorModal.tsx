import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import { useState, useRef } from 'react'
import { getTMDbService } from '~/services/tmdb'
import type { TMDbTitle, TMDbImage } from '~/types'

interface MediaImageSelectorModalProps {
  visible: boolean
  onClose: () => void
  onSelectImage: (url: string) => void
  imageType: 'banner' | 'avatar'
}

export function MediaImageSelectorModal({
  visible,
  onClose,
  onSelectImage,
  imageType,
}: MediaImageSelectorModalProps) {
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TMDbTitle[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState<TMDbTitle | null>(null)
  const [mediaImages, setMediaImages] = useState<TMDbImage[]>([])

  const flatListRef = useRef<FlatList>(null)

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    setSelectedMedia(null)
    setMediaImages([])
    try {
      const tmdb = getTMDbService()
      const response = await tmdb.search(query)
      // Filter out items without posters or backdrops based on need
      const filtered = response.results.filter((item) => 
        imageType === 'banner' ? item.backdrop_path : item.poster_path
      )
      setSearchResults(filtered)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleMediaSelect = async (media: TMDbTitle) => {
    setSelectedMedia(media)
    setLoading(true)
    try {
      const tmdb = getTMDbService()
      const mediaTypeForApi = media.media_type || (media.title ? 'movie' : 'tv')
      const imagesData = await tmdb.getMediaImages(mediaTypeForApi as 'movie' | 'tv', media.id)
      
      let targetImages: TMDbImage[] = []
      if (imageType === 'banner') {
        targetImages = imagesData.backdrops
      } else {
        targetImages = imagesData.posters
      }
      
      // Sort by vote_average to show best first
      targetImages.sort((a, b) => b.vote_average - a.vote_average)
      setMediaImages(targetImages)
    } catch (error) {
      console.error('Failed to load media images:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleImageSelect = (item: TMDbImage) => {
    const tmdb = getTMDbService()
    // For avatars use w500 to keep it sharp, for banners use original or w1280
    const url = imageType === 'banner' 
      ? tmdb.getBackdropUrl(item.file_path, 'w1280') 
      : tmdb.getImageUrl(item.file_path, 'original')
      
    if (url) {
      onSelectImage(url)
      handleClose()
    }
  }

  const handleBack = () => {
    setSelectedMedia(null)
    setMediaImages([])
  }

  const handleClose = () => {
    setQuery('')
    setSearchResults([])
    setSelectedMedia(null)
    setMediaImages([])
    onClose()
  }

  // Determine grid layout based on image type
  const numColumns = imageType === 'banner' ? 1 : 2

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <BlurView intensity={20} className="flex-1 pt-12">
        <View className="flex-1 bg-primary rounded-t-3xl overflow-hidden border-t border-white/10">
          
          {/* Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-white/10 bg-surface">
            {selectedMedia && (
              <TouchableOpacity onPress={handleBack} className="mr-3">
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
            )}
            <Text className="text-3xl font-black text-white italic tracking-tighter uppercase flex-1">
              {imageType === 'banner' ? 'SELECT BANNER' : 'SELECT AVATAR'}
              <Text className="text-accent">.</Text>
            </Text>
            <TouchableOpacity onPress={handleClose} className="p-2">
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {!selectedMedia ? (
            <>
              {/* Search Bar */}
              <View className="p-4 flex-row gap-2">
                <View className="flex-1 flex-row items-center bg-surface px-4 py-2 rounded-lg border border-white/5">
                  <Ionicons name="search" size={20} color="#9CA3AF" />
                  <TextInput
                    className="flex-1 ml-2 text-text-primary font-medium"
                    placeholder="Search movies or series..."
                    placeholderTextColor="#9CA3AF"
                    value={query}
                    onChangeText={setQuery}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                    autoFocus
                  />
                </View>
              </View>

              {/* Search Results */}
              {loading ? (
                <ActivityIndicator size="large" color="#1DB954" className="mt-8" />
              ) : (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.id.toString()}
                  contentContainerStyle={{ padding: 16, gap: 16 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      className="bg-surface rounded-xl overflow-hidden border border-white/5 active:opacity-80 flex-row"
                      onPress={() => handleMediaSelect(item)}
                    >
                      <View className="w-20 h-28 bg-black/50">
                        <Image
                          source={item.poster_path ? { uri: `https://image.tmdb.org/t/p/w200${item.poster_path}` } : undefined}
                          className="w-full h-full"
                          resizeMode="cover"
                        />
                      </View>
                      <View className="flex-1 justify-center p-4">
                        <Text className="text-text-primary font-bold text-base" numberOfLines={2}>
                          {item.title || item.name}
                        </Text>
                        <Text className="text-text-secondary text-xs mt-1">
                          {(item.release_date || item.first_air_date || '').split('-')[0]}
                        </Text>
                      </View>
                      <View className="justify-center pr-4">
                        <Ionicons name="chevron-forward" size={20} color="#666" />
                      </View>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <View className="items-center mt-12 px-6">
                      <Ionicons name="search-outline" size={48} color="#333" />
                      <Text className="text-text-secondary mt-4 text-center">
                        Search for a title to use its {imageType === 'banner' ? 'backdrop' : 'poster'} as your profile {imageType}.
                      </Text>
                    </View>
                  }
                />
              )}
            </>
          ) : (
            <>
              {/* Image Grid View */}
              {loading ? (
                <ActivityIndicator size="large" color="#1DB954" className="mt-8" />
              ) : (
                <FlatList
                  ref={flatListRef}
                  key={numColumns} // Force re-render on layout change
                  data={mediaImages}
                  keyExtractor={(item, index) => `${item.file_path}-${index}`}
                  numColumns={numColumns}
                  contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
                  columnWrapperStyle={numColumns > 1 ? { gap: 12, justifyContent: 'space-between' } : undefined}
                  renderItem={({ item }) => {
                    const aspectClass = imageType === 'banner' ? 'aspect-video' : 'aspect-[2/3]'
                    const uri = `https://image.tmdb.org/t/p/w500${item.file_path}`
                    return (
                      <TouchableOpacity
                        className={`bg-surface rounded-xl overflow-hidden border border-white/5 active:opacity-80 mb-3 ${numColumns > 1 ? 'flex-1' : 'w-full'}`}
                        style={numColumns > 1 ? { width: '48%' } : {}}
                        onPress={() => handleImageSelect(item)}
                      >
                        <View className={`w-full ${aspectClass} bg-black/50`}>
                          <Image
                            source={{ uri }}
                            className="w-full h-full"
                            resizeMode="cover"
                          />
                        </View>
                      </TouchableOpacity>
                    )
                  }}
                  ListEmptyComponent={
                    <View className="items-center mt-12 px-6">
                      <Ionicons name="image-outline" size={48} color="#333" />
                      <Text className="text-text-secondary mt-4 text-center">
                        No high-quality {imageType === 'banner' ? 'backdrops' : 'posters'} found for this title.
                      </Text>
                    </View>
                  }
                />
              )}
            </>
          )}
        </View>
      </BlurView>
    </Modal>
  )
}
