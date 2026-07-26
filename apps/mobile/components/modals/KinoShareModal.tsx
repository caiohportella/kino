import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import type { ComponentProps } from 'react'
import { useState } from 'react'
import { Linking, Modal, Pressable, Share, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'

export interface NativeShareResource {
  title: string
  canonicalUrl: string
  shareText: string
  subtitle?: string
}

const destinations = [
  {
    id: 'whatsapp',
    icon: 'logo-whatsapp' as const,
    color: '#25d366',
    url: (resource: NativeShareResource) =>
      `https://wa.me/?text=${encodeURIComponent(`${resource.shareText} ${resource.canonicalUrl}`)}`,
  },
  {
    id: 'reddit',
    icon: 'logo-reddit' as const,
    color: '#ff4500',
    url: (resource: NativeShareResource) =>
      `https://www.reddit.com/submit?url=${encodeURIComponent(resource.canonicalUrl)}&title=${encodeURIComponent(resource.title)}`,
  },
  {
    id: 'x',
    icon: 'logo-twitter' as const,
    color: '#111111',
    url: (resource: NativeShareResource) =>
      `https://x.com/intent/post?text=${encodeURIComponent(resource.shareText)}&url=${encodeURIComponent(resource.canonicalUrl)}`,
  },
  {
    id: 'facebook',
    icon: 'logo-facebook' as const,
    color: '#1877f2',
    url: (resource: NativeShareResource) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(resource.canonicalUrl)}`,
  },
  {
    id: 'telegram',
    icon: 'paper-plane' as const,
    color: '#229ed9',
    url: (resource: NativeShareResource) =>
      `https://t.me/share/url?url=${encodeURIComponent(resource.canonicalUrl)}&text=${encodeURIComponent(resource.shareText)}`,
  },
] as const

export function KinoShareModal({
  onClose,
  resource,
  visible,
}: {
  onClose: () => void
  resource: NativeShareResource
  visible: boolean
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    await Clipboard.setStringAsync(resource.canonicalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}
    >
      <Pressable className="flex-1 justify-end bg-black/70" onPress={onClose}>
        <Pressable
          accessibilityViewIsModal
          className="rounded-t-2xl border-t border-white/10 bg-surface px-5 pb-10 pt-5"
          onPress={(event) => event.stopPropagation()}
        >
          <View className="mb-5 flex-row items-start justify-between">
            <View className="mr-4 flex-1">
              <Text className="text-xl font-bold text-text">{t('common.share')}</Text>
              <Text className="mt-1 text-sm text-textSecondary">{resource.title}</Text>
              {resource.subtitle ? (
                <Text className="mt-1 text-xs text-textSecondary">{resource.subtitle}</Text>
              ) : null}
            </View>
            <Pressable
              accessibilityLabel={t('common.close')}
              className="h-11 w-11 items-center justify-center rounded-full bg-white/5"
              onPress={onClose}
            >
              <Ionicons color="#e0e0e0" name="close" size={22} />
            </Pressable>
          </View>

          <View className="flex-row flex-wrap gap-y-5">
            {destinations.map((destination) => (
              <ShareAction
                color={destination.color}
                icon={destination.icon}
                key={destination.id}
                label={t(`sharing.${destination.id}`)}
                onPress={() => void Linking.openURL(destination.url(resource))}
              />
            ))}
            <ShareAction
              color="#2a2a2a"
              icon={copied ? 'checkmark' : 'copy-outline'}
              label={copied ? t('sharing.copied') : t('sharing.copyLink')}
              onPress={() => void copyLink()}
            />
            <ShareAction
              color="#2a2a2a"
              icon="ellipsis-horizontal"
              label={t('sharing.moreOptions')}
              onPress={() =>
                void Share.share({
                  message: `${resource.shareText} ${resource.canonicalUrl}`,
                  title: resource.title,
                  url: resource.canonicalUrl,
                })
              }
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function ShareAction({
  color,
  icon,
  label,
  onPress,
}: {
  color: string
  icon: ComponentProps<typeof Ionicons>['name']
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      className="w-1/4 items-center gap-2 px-1"
      onPress={onPress}
    >
      <View
        className="h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: color }}
      >
        <Ionicons color="#ffffff" name={icon} size={22} />
      </View>
      <Text className="text-center text-xs font-semibold text-textSecondary" numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  )
}
