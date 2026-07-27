import type { PublicUserSummary } from '@kino/core'
import { useState } from 'react'
import { Image, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { RatingStars } from '~/components/common/RatingStars'

export function ReviewComposer({
  author,
  rating,
  pending,
  onPublish,
}: {
  author: PublicUserSummary
  rating: number | null
  pending: boolean
  onPublish: (content: string) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const [content, setContent] = useState('')
  const remaining = 2000 - content.length
  const name = author.displayName || author.username || t('reviews.user')

  return (
    <View className="flex-row gap-3">
      {author.avatarUrl ? (
        <Image
          accessibilityLabel={`${name} avatar`}
          className="h-10 w-10 rounded-full"
          source={{ uri: author.avatarUrl }}
        />
      ) : (
        <View className="h-10 w-10 items-center justify-center rounded-full bg-primary">
          <Text className="font-bold text-text-secondary">{name[0]?.toUpperCase()}</Text>
        </View>
      )}
      <View className="flex-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-sm text-text-secondary">
            {t('reviews.reviewedBy')}{' '}
            <Text className="font-bold text-text-primary">{name}</Text>
          </Text>
          {rating ? <RatingStars rating={rating} readonly size={14} /> : null}
        </View>
        <TextInput
          accessibilityLabel={t('reviews.writeReview')}
          className="mt-3 min-h-24 rounded-lg border border-black/50 bg-primary p-3 text-sm text-text-primary"
          editable={!pending}
          maxLength={2000}
          multiline
          onChangeText={setContent}
          placeholder={t('reviews.composer.placeholder')}
          placeholderTextColor="#8A8A8A"
          textAlignVertical="top"
          value={content}
        />
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-xs text-text-secondary">
            {remaining <= 200 ? t('reviews.charactersRemaining', { count: remaining }) : ''}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            className="rounded-lg bg-accent px-4 py-2 disabled:opacity-50"
            disabled={pending || !content.trim()}
            onPress={async () => {
              if (await onPublish(content)) setContent('')
            }}
          >
            <Text className="font-bold text-black">{t('reviews.publish')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}
