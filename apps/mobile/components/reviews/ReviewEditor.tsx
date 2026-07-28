import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, TextInput, TouchableOpacity, View } from 'react-native'

export function ReviewEditor({
  initialContent,
  pending,
  onCancel,
  onSave,
}: {
  initialContent: string
  pending: boolean
  onCancel: () => void
  onSave: (content: string) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const [content, setContent] = useState(initialContent)
  return (
    <View>
      <TextInput
        accessibilityLabel={t('reviews.edit')}
        autoFocus
        className="min-h-24 rounded-lg border border-black/50 bg-primary p-3 text-text-primary"
        editable={!pending}
        maxLength={2000}
        multiline
        onChangeText={setContent}
        textAlignVertical="top"
        value={content}
      />
      <View className="mt-2 flex-row justify-end gap-3">
        <TouchableOpacity disabled={pending} onPress={onCancel}>
          <Text className="font-semibold text-text-secondary">{t('common.cancel')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={pending || !content.trim()}
          onPress={() => void onSave(content)}
        >
          <Text className="font-semibold text-accent">{t('reviews.save')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
