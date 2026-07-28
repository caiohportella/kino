import { Ionicons } from '@expo/vector-icons'
import type { Review } from '@kino/core'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Image, Text, TouchableOpacity, View } from 'react-native'
import { RatingStars } from '~/components/common/RatingStars'
import { ReviewEditor } from './ReviewEditor'

export function ReviewCard({
  review,
  authenticated,
  pending,
  onAuthRequired,
  onDelete,
  onLike,
  onUpdate,
}: {
  review: Review
  authenticated: boolean
  pending: boolean
  onAuthRequired: () => void
  onDelete: () => Promise<void>
  onLike: () => void
  onUpdate: (content: string) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const name = review.author.displayName || review.author.username || t('reviews.user')

  return (
    <View className="flex-row gap-3 border-t border-black/30 py-4">
      {review.author.avatarUrl ? (
        <Image
          accessibilityLabel={`${name} avatar`}
          className="h-10 w-10 rounded-full"
          source={{ uri: review.author.avatarUrl }}
        />
      ) : (
        <View className="h-10 w-10 items-center justify-center rounded-full bg-primary">
          <Text className="font-bold text-text-secondary">{name[0]?.toUpperCase()}</Text>
        </View>
      )}
      <View className="flex-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-sm text-text-secondary">
            {t('reviews.reviewedBy')} <Text className="font-bold text-text-primary">{name}</Text>
          </Text>
          {review.rating ? <RatingStars rating={review.rating} readonly size={14} /> : null}
        </View>
        <View className="mt-3">
          {editing ? (
            <ReviewEditor
              initialContent={review.content}
              onCancel={() => setEditing(false)}
              onSave={async (content) => {
                const saved = await onUpdate(content)
                if (saved) setEditing(false)
                return saved
              }}
              pending={pending}
            />
          ) : (
            <Text className="text-sm leading-6 text-text-primary">{review.content}</Text>
          )}
        </View>
        <View className="mt-3 flex-row items-center gap-4">
          {!review.isViewerReview ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: review.likedByViewer }}
              className="flex-row items-center gap-1.5"
              disabled={pending}
              onPress={() => (authenticated ? onLike() : onAuthRequired())}
            >
              <Ionicons
                color={review.likedByViewer ? '#1DB954' : '#8A8A8A'}
                name={review.likedByViewer ? 'heart' : 'heart-outline'}
                size={17}
              />
              <Text className={review.likedByViewer ? 'text-accent' : 'text-text-secondary'}>
                {t(review.likedByViewer ? 'reviews.unlike' : 'reviews.like')}
              </Text>
              <Text className="text-text-secondary">
                {t('reviews.likeCount', { count: review.likeCount })}
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity disabled={pending} onPress={() => setEditing(true)}>
                <Text className="font-semibold text-text-secondary">{t('reviews.edit')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={pending}
                onPress={() =>
                  Alert.alert(t('reviews.delete'), t('reviews.deleteConfirm'), [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                      text: t('reviews.delete'),
                      style: 'destructive',
                      onPress: () => void onDelete(),
                    },
                  ])
                }
              >
                <Text className="font-semibold text-red-400">{t('reviews.delete')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  )
}
