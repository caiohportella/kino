import React from 'react'
import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useOscarData, isOscarNomineeLegacy, getOscarNominationsLegacy } from '~/services/awards'

interface OscarBadgeProps {
  tmdbId: number
  showLabel?: boolean
  size?: 'small' | 'normal'
}

export function OscarBadge({ tmdbId, showLabel = true, size = 'normal' }: OscarBadgeProps) {
  const { t } = useTranslation()
  const { data: awards } = useOscarData(2026)
  
  const nominations = awards ? awards[tmdbId] : (isOscarNomineeLegacy(tmdbId) ? getOscarNominationsLegacy(tmdbId) : null)
  const isNominee = !!nominations
  const isWinner = nominations?.some(n => n.isWinner)

  if (!isNominee) return null

  const isSmall = size === 'small'
  
  if (isSmall) {
    const badgeColor = isWinner ? 'bg-[#D4AF37]' : 'bg-[#1DB954]'
    return (
      <View className="absolute top-1.5 left-1.5 z-10">
        <View 
          className={`${badgeColor} w-6 h-6 rounded-full items-center justify-center`}
          style={isWinner ? { shadowColor: '#D4AF37', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 4, elevation: 4 } : {}}
        >
          <Ionicons name="trophy" size={12} color="white" />
        </View>
      </View>
    )
  }

  // Normal / Pill variant
  const badgeColor = isWinner ? 'bg-[#D4AF37]' : 'bg-accent/80'
  return (
    <View className="absolute top-2 left-0 right-0 items-center z-10">
      <View 
        className={`${badgeColor} rounded-full px-2 py-0.5 flex-row items-center gap-1 backdrop-blur-md border border-white/20`}
        style={isWinner ? { shadowColor: '#D4AF37', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 5, elevation: 5 } : {}}
      >
        <Ionicons name="trophy" size={10} color="white" />
        {showLabel && (
          <Text
            className="text-white font-black uppercase tracking-widest text-[8px]"
          >
            {isWinner ? t('awards.oscarWinner') : t('awards.oscarNominee')}
          </Text>
        )}
      </View>
    </View>
  )
}
