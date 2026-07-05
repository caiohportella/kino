import { useMemo, useState } from 'react'
import {
  Alert,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import DateTimePicker from '@react-native-community/datetimepicker'
import { format } from 'date-fns'
import { LinearGradient } from 'expo-linear-gradient'

import { useAuth } from '@/hooks/useAuth'
import { dbService } from '~/services/database'
import { getTMDbService } from '~/services/tmdb'
import { transformMovieToTitleDetails, transformTVToTitleDetails } from '~/utils/tmdb-transform'
import { parseImportFileFromUri } from '~/utils/imports/history-import'
import type { ImportSource, ImportTitleItem, ParsedImportResult } from '~/types/imports'

type ImportState = {
  fileName: string
  source: ImportSource | null
  items: ImportTitleItem[]
  warnings: string[]
  errors: string[]
}

const EMPTY_STATE: ImportState = {
  fileName: '',
  source: null,
  items: [],
  warnings: [],
  errors: [],
}

export default function ImportHistoryScreen() {
  const router = useRouter()
  const { user } = useAuth()

  const [state, setState] = useState<ImportState>(EMPTY_STATE)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  const [datePickerId, setDatePickerId] = useState<string | null>(null)

  const summary = useMemo(() => {
    const included = state.items.filter((item) => item.include)
    return {
      total: state.items.length,
      included: included.length,
      movies: included.filter((item) => item.mediaType === 'movie').length,
      series: included.filter((item) => item.mediaType === 'tv').length,
      withIssues: included.filter((item) => item.issue || item.rating === null).length,
    }
  }, [state.items])

  const handlePickFile = async (source: ImportSource) => {
    try {
      setLoading(true)

      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type:
          source === 'tvtime'
            ? ['application/zip', 'application/x-zip-compressed', 'application/octet-stream']
            : ['text/csv', 'application/csv', 'text/plain'],
      })

      if (result.canceled || !result.assets?.[0]) {
        return
      }

      const asset = result.assets[0]
      const fileName = asset.name || 'import'
      const parsed = await parseImportFileFromUri(
        fileName,
        asset.uri,
        async (uri) => FileSystem.readAsStringAsync(uri),
        async (uri) => FileSystem.readAsStringAsync(uri, {
          encoding: 'base64',
        })
      )

      applyParseResult(parsed)
    } catch (error) {
      console.error('[Import] Failed to read file', error)
      setState({
        fileName: '',
        source: null,
        items: [],
        warnings: [],
        errors: ['We could not read that file. Please try another export.'],
      })
    } finally {
      setLoading(false)
    }
  }

  const applyParseResult = (result: ParsedImportResult) => {
    setState({
      fileName: result.fileName,
      source: result.source,
      items: result.items,
      warnings: result.warnings,
      errors: result.errors,
    })
  }

  const updateItem = (id: string, updates: Partial<ImportTitleItem>) => {
    setState((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    }))
  }

  const handleReset = () => {
    setState(EMPTY_STATE)
    setDatePickerId(null)
  }

  const handleImport = async () => {
    if (!user) {
      Alert.alert('Import', 'Please log in before importing history.')
      return
    }

    const includedItems = state.items.filter((item) => item.include)
    if (includedItems.length === 0) {
      Alert.alert('Import', 'Choose at least one item to import.')
      return
    }

    const validationErrors = validateItems(includedItems)
    if (validationErrors.length > 0) {
      Alert.alert('Import', validationErrors[0])
      return
    }

    setImporting(true)
    setProgress({ completed: 0, total: includedItems.length })

    try {
      for (let index = 0; index < includedItems.length; index += 1) {
        const item = includedItems[index]
        const titleId = await resolveTitleId(item)
        if (!titleId) {
          throw new Error(`Could not match ${item.title} in TMDb.`)
        }

        if (item.mediaType === 'movie') {
          if (item.rating === null) {
            throw new Error(`"${item.title}" needs a rating before it can be imported.`)
          }

          const watchedAt = new Date(item.watchedAt)
          await dbService.rateTitle(titleId, item.rating, item.watchType, watchedAt, item.notes)
          await dbService.addWatchDiaryEntry(titleId, watchedAt, item.watchType, item.notes)
        } else {
          const episodes = item.tvEpisodes || []
          for (const episode of episodes) {
            const episodeRating = episode.rating ?? item.rating
            if (episodeRating === null) {
              throw new Error(`"${item.title}" needs a rating before it can be imported.`)
            }

            await dbService.rateEpisode(
              titleId,
              episode.seasonNumber,
              episode.episodeNumber,
              episodeRating,
              episode.watchType,
              new Date(episode.watchedAt),
              item.notes
            )
          }

          await dbService.addWatchDiaryEntry(
            titleId,
            new Date(item.watchedAt),
            item.watchType,
            item.notes
          )
        }

        setProgress({ completed: index + 1, total: includedItems.length })
      }

      Alert.alert('Import completed', `We saved ${includedItems.length} items to your Kino library.`, [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (error) {
      console.error('[Import] Import failed', error)
      Alert.alert('Import failed', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setImporting(false)
    }
  }

  const allItems = state.items
  const hasItems = allItems.length > 0

  return (
    <SafeAreaView className="flex-1 bg-primary">
      <Stack.Screen
        options={{
          title: 'Import History',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#121212' },
          headerTintColor: '#fff',
          headerShadowVisible: false,
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <FlatList
          data={allItems}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 120 }}
          ListHeaderComponent={
            <View className="px-4 pt-4">
              <LinearGradient
                colors={['#1DB954', '#0F6F35', '#121212']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="rounded-3xl p-5 overflow-hidden"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="text-white text-2xl font-black tracking-tight">
                      Import your history
                    </Text>
                    <Text className="text-white/85 mt-2 text-sm leading-5">
                      Upload a TV Time export ZIP or a Letterboxd CSV. Kino parses the file locally,
                      lets you review the preview, and then writes the mapped data to your account.
                    </Text>
                  </View>
                  <Ionicons name="cloud-upload-outline" size={36} color="#fff" />
                </View>
              </LinearGradient>

              <View className="mt-4 rounded-2xl border border-white/5 bg-surface p-4">
                <Text className="text-xs font-bold uppercase tracking-[0.2em] text-text-secondary">
                  Privacy
                </Text>
                <Text className="mt-2 text-sm leading-5 text-text-secondary">
                  Your export is processed on this device before anything is saved to Kino. We do not
                  connect to TV Time or Letterboxd directly, so you keep control of the file you
                  upload.
                </Text>
              </View>

              <View className="mt-4">
                <Text className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-text-secondary">
                  Choose a source
                </Text>
                <View className="space-y-3">
                  <SourceCard
                    title="TV Time export"
                    body="Upload the GDPR ZIP export from TV Time. Kino maps watched episodes, movie watches, and ratings."
                    icon="tv-outline"
                    onPress={() => handlePickFile('tvtime')}
                    buttonLabel={state.source === 'tvtime' ? 'Replace file' : 'Upload file'}
                  />
                  <SourceCard
                    title="Letterboxd export"
                    body="Upload the CSV export from Letterboxd. Kino imports watch dates, ratings, and rewatch flags."
                    icon="film-outline"
                    onPress={() => handlePickFile('letterboxd')}
                    buttonLabel={state.source === 'letterboxd' ? 'Replace file' : 'Upload file'}
                  />
                </View>
              </View>

              <View className="mt-4 rounded-2xl border border-white/5 bg-surface p-4">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-base font-bold text-text-primary">Preview</Text>
                    <Text className="text-sm text-text-secondary">
                      Review the mapped items before saving them.
                    </Text>
                  </View>
                  {hasItems ? (
                    <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                      {summary.included} ready
                    </Text>
                  ) : null}
                </View>

                {state.errors.length > 0 ? (
                  <View className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3">
                    <Text className="text-sm font-bold text-red-400">Fix these first</Text>
                    {state.errors.map((error) => (
                      <Text key={error} className="mt-1 text-sm text-red-300">
                        {error}
                      </Text>
                    ))}
                  </View>
                ) : null}

                {state.warnings.length > 0 ? (
                  <View className="mt-4 rounded-xl border border-orange-500/40 bg-orange-500/10 p-3">
                    <Text className="text-sm font-bold text-orange-300">Warnings</Text>
                    {state.warnings.map((warning) => (
                      <Text key={warning} className="mt-1 text-sm text-orange-200">
                        {warning}
                      </Text>
                    ))}
                  </View>
                ) : null}

                {!hasItems ? (
                  <View className="mt-4 items-center rounded-2xl border border-dashed border-white/10 py-8">
                    <Ionicons name="cloud-upload-outline" size={28} color="#666" />
                    <Text className="mt-3 text-base font-semibold text-text-primary">
                      No file selected yet
                    </Text>
                    <Text className="mt-1 px-6 text-center text-sm text-text-secondary">
                      Upload a TV Time ZIP or Letterboxd CSV to preview the import.
                    </Text>
                  </View>
                ) : (
                  <View className="mt-4 flex-row flex-wrap gap-2">
                    <StatChip label="Items" value={summary.total} />
                    <StatChip label="Included" value={summary.included} />
                    <StatChip label="Movies" value={summary.movies} />
                    <StatChip label="Series" value={summary.series} />
                    <StatChip label="Needs review" value={summary.withIssues} tone="warning" />
                  </View>
                )}

                {state.fileName ? (
                  <View className="mt-4 rounded-xl bg-primary/70 px-3 py-2">
                    <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary">
                      Selected file
                    </Text>
                    <Text className="mt-1 text-sm text-text-primary">{state.fileName}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          }
          ListEmptyComponent={null}
          renderItem={({ item }) => (
            <ImportRowCard
              item={item}
              onChange={updateItem}
              onDatePress={setDatePickerId}
              datePickerId={datePickerId}
              onToggleInclude={(include) => updateItem(item.id, { include })}
            />
          )}
          ListFooterComponent={
            <View className="px-4 pt-4">
              {datePickerId ? (
                (() => {
                  const current = state.items.find((entry) => entry.id === datePickerId)
                  if (!current) return null
                  return (
                    <View className="mb-4 rounded-2xl border border-white/5 bg-surface p-3">
                      <Text className="mb-2 text-sm font-semibold text-text-primary">
                        Adjust watched date
                      </Text>
                      <DateTimePicker
                        value={new Date(current.watchedAt)}
                        mode="date"
                        display="default"
                        onChange={(_, date) => {
                          if (date) {
                            updateItem(current.id, { watchedAt: date.toISOString() })
                          }
                          setDatePickerId(null)
                        }}
                      />
                    </View>
                  )
                })()
              ) : null}

              {importing ? (
                <View className="rounded-2xl border border-white/5 bg-surface p-4">
                  <Text className="text-base font-semibold text-text-primary">Importing...</Text>
                  <Text className="mt-1 text-sm text-text-secondary">
                    {progress.completed} of {progress.total} saved
                  </Text>
                  <View className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <View
                      className="h-full rounded-full bg-accent"
                      style={{
                        width: `${progress.total === 0 ? 0 : (progress.completed / progress.total) * 100}%`,
                      }}
                    />
                  </View>
                </View>
              ) : null}

              <View className="mt-4 flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 items-center rounded-2xl border border-white/10 bg-surface px-4 py-4"
                  onPress={handleReset}
                  disabled={loading || importing}
                >
                  <Text className="font-semibold text-text-primary">Start over</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-1 items-center rounded-2xl bg-accent px-4 py-4"
                  onPress={handleImport}
                  disabled={loading || importing || !hasItems}
                >
                  {loading || importing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="font-semibold text-white">Import into Kino</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function SourceCard({
  title,
  body,
  icon,
  onPress,
  buttonLabel,
}: {
  title: string
  body: string
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
  buttonLabel: string
}) {
  return (
    <View className="rounded-2xl border border-white/5 bg-surface p-4">
      <View className="flex-row items-start">
        <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-white/5">
          <Ionicons name={icon} size={20} color="#1DB954" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-text-primary">{title}</Text>
          <Text className="mt-1 text-sm leading-5 text-text-secondary">{body}</Text>
        </View>
      </View>

      <TouchableOpacity
        className="mt-4 items-center rounded-xl bg-accent px-4 py-3"
        onPress={onPress}
      >
        <Text className="font-semibold text-white">{buttonLabel}</Text>
      </TouchableOpacity>
    </View>
  )
}

function ImportRowCard({
  item,
  onChange,
  onDatePress,
  datePickerId,
  onToggleInclude,
}: {
  item: ImportTitleItem
  onChange: (id: string, updates: Partial<ImportTitleItem>) => void
  onDatePress: (id: string | null) => void
  datePickerId: string | null
  onToggleInclude: (include: boolean) => void
}) {
  const watchedAtText = useMemo(() => format(new Date(item.watchedAt), 'PP'), [item.watchedAt])

  return (
    <View
      className={`mx-4 mb-3 rounded-2xl border p-4 ${item.include ? 'border-white/5 bg-surface' : 'border-white/5 bg-surface/60 opacity-60'}`}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <View className="flex-row items-center gap-2">
            <Text className="text-base font-bold text-text-primary" numberOfLines={1}>
              {item.title}
            </Text>
            <View className="rounded-full bg-white/5 px-2 py-1">
              <Text className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary">
                {item.mediaType === 'movie' ? 'Movie' : 'Series'}
              </Text>
            </View>
          </View>
          <Text className="mt-1 text-xs uppercase tracking-[0.2em] text-text-secondary">
            {item.sourceLabel} {item.count > 1 ? ` - ${item.count} items` : ''}
          </Text>
        </View>

        <TouchableOpacity
          className="h-9 w-9 items-center justify-center rounded-full bg-white/5"
          onPress={() => onToggleInclude(!item.include)}
        >
          <Ionicons
            name={item.include ? 'checkbox-outline' : 'square-outline'}
            size={20}
            color={item.include ? '#1DB954' : '#888'}
          />
        </TouchableOpacity>
      </View>

      {item.issue || item.rating === null ? (
        <View className="mt-3 rounded-xl border border-orange-500/40 bg-orange-500/10 px-3 py-2">
          <Text className="text-sm font-semibold text-orange-200">Needs review</Text>
          <Text className="mt-1 text-sm text-orange-100">
            {item.issue || 'Rating is required before import.'}
          </Text>
        </View>
      ) : null}

      <View className="mt-4 space-y-3">
        <View>
          <Text className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-text-secondary">
            Title
          </Text>
          <TextInput
            className="rounded-xl border border-white/5 bg-primary px-3 py-3 text-text-primary"
            value={item.title}
            onChangeText={(text) => onChange(item.id, { title: text })}
            placeholder="Title"
            placeholderTextColor="#666"
          />
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Text className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-text-secondary">
              Watched on
            </Text>
            <TouchableOpacity
              className="rounded-xl border border-white/5 bg-primary px-3 py-3"
              onPress={() => onDatePress(datePickerId === item.id ? null : item.id)}
            >
              <Text className="text-text-primary">{watchedAtText}</Text>
            </TouchableOpacity>
          </View>

          <View className="w-24">
            <Text className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-text-secondary">
              Rating
            </Text>
            <TextInput
              className="rounded-xl border border-white/5 bg-primary px-3 py-3 text-text-primary"
              value={item.rating === null ? '' : String(item.rating)}
              onChangeText={(text) => {
                const next = text.trim()
                onChange(item.id, { rating: next ? Number(next) : null })
              }}
              placeholder="n/a"
              placeholderTextColor="#666"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View>
          <Text className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-text-secondary">
            Watch type
          </Text>
          <View className="flex-row gap-2">
            <SegmentButton
              label="First time"
              active={item.watchType === 'first-time'}
              onPress={() => onChange(item.id, { watchType: 'first-time' })}
            />
            <SegmentButton
              label="Rewatch"
              active={item.watchType === 'rewatch'}
              onPress={() => onChange(item.id, { watchType: 'rewatch' })}
            />
          </View>
        </View>

        {item.notes ? (
          <View>
            <Text className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-text-secondary">
              Notes
            </Text>
            <Text className="text-sm text-text-secondary">{item.notes}</Text>
          </View>
        ) : null}

        {item.mediaType === 'tv' && item.tvEpisodes ? (
          <Text className="text-xs text-text-secondary">
            {item.tvEpisodes.length} episode entries will be written into Kino.
          </Text>
        ) : null}
      </View>
    </View>
  )
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      className={`rounded-full px-3 py-2 ${active ? 'bg-accent' : 'bg-white/5'}`}
      onPress={onPress}
    >
      <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-text-secondary'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

function StatChip({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'warning'
}) {
  return (
    <View
      className={`rounded-full px-3 py-2 ${tone === 'warning' ? 'bg-orange-500/10' : 'bg-white/5'}`}
    >
      <Text
        className={`text-[10px] font-bold uppercase tracking-[0.2em] ${tone === 'warning' ? 'text-orange-300' : 'text-text-secondary'}`}
      >
        {label}
      </Text>
      <Text
        className={`mt-1 text-sm font-semibold ${tone === 'warning' ? 'text-orange-200' : 'text-text-primary'}`}
      >
        {value}
      </Text>
    </View>
  )
}

function validateItems(items: ImportTitleItem[]): string[] {
  const issues: string[] = []

  for (const item of items) {
    if (!item.title.trim()) {
      issues.push('One or more rows have no title.')
      break
    }

    if (Number.isNaN(new Date(item.watchedAt).getTime())) {
      issues.push(`"${item.title}" is missing a valid watched date.`)
      break
    }

    if (item.rating === null) {
      issues.push(`"${item.title}" needs a rating before it can be imported.`)
      break
    }

    if (item.rating < 0 || item.rating > 5) {
      issues.push(`"${item.title}" has a rating outside Kino's 0-5 scale.`)
      break
    }
  }

  return issues
}

async function resolveTitleId(item: ImportTitleItem): Promise<string | null> {
  const tmdb = getTMDbService()
  const searchResult = await tmdb.search(item.title.trim())
  const candidates = searchResult.results.filter((result) => result.media_type === item.mediaType)

  if (candidates.length === 0) {
    return null
  }

  const chosen = chooseBestCandidate(item, candidates)
  if (!chosen) {
    return null
  }

  if (item.mediaType === 'movie') {
    const details = await tmdb.getMovieDetails(chosen.id)
    const credits = await tmdb.getMovieCredits(chosen.id)
    const transformed = await transformMovieToTitleDetails(details, credits)
    return dbService.getOrCreateTitle(transformed)
  }

  const details = await tmdb.getTVDetails(chosen.id)
  const credits = await tmdb.getTVCredits(chosen.id)
  const transformed = await transformTVToTitleDetails(details, credits)
  return dbService.getOrCreateTitle(transformed)
}

function chooseBestCandidate(
  item: ImportTitleItem,
  candidates: Array<{ id: number; title?: string; name?: string; release_date?: string; first_air_date?: string }>
): { id: number } | null {
  const normalizedTarget = normalizeText(item.title)

  const scored = candidates
    .map((candidate) => {
      const candidateTitle = normalizeText(candidate.title || candidate.name || '')
      const candidateYear = parseYear(candidate.release_date || candidate.first_air_date || '')
      let score = 0

      if (candidateTitle === normalizedTarget) score += 10
      if (candidateTitle.includes(normalizedTarget) || normalizedTarget.includes(candidateTitle)) score += 5
      if (item.year && candidateYear === item.year) score += 4
      return { id: candidate.id, score }
    })
    .sort((left, right) => right.score - left.score)

  return scored[0] && scored[0].score > 0 ? { id: scored[0].id } : { id: scored[0].id }
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
}

function parseYear(value: string): number | null {
  const year = Number.parseInt(value.slice(0, 4), 10)
  return Number.isFinite(year) ? year : null
}
