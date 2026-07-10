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
import { Stack } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import DateTimePicker from '@react-native-community/datetimepicker'
import { LinearGradient } from 'expo-linear-gradient'
import { formatDate } from '@kino/core'

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
  const { user } = useAuth()

  const [state, setState] = useState<ImportState>(EMPTY_STATE)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({
    completed: 0,
    total: 0,
    imported: 0,
    skipped: 0,
    failed: 0,
  })
  const [datePickerId, setDatePickerId] = useState<string | null>(null)
  const [page, setPage] = useState(1)

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
    setPage(1)
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
    setPage(1)
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

    setImporting(true)
    setProgress({
      completed: 0,
      total: includedItems.length,
      imported: 0,
      skipped: 0,
      failed: 0,
    })

    let importedCount = 0
    let skippedCount = 0
    let failureCount = 0

    // Reset status of all items to idle/processing before starting
    setState((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.include
          ? { ...item, importStatus: 'idle', importError: undefined }
          : item
      ),
    }))

    try {
      for (let index = 0; index < includedItems.length; index += 1) {
        const item = includedItems[index]

        // Update status of the item currently being imported
        updateItem(item.id, { importStatus: 'processing' })

        try {
          const resolvedTitle = await resolveTitleId(item, (id, newMediaType) => {
            updateItem(id, { mediaType: newMediaType })
          })

          if (!resolvedTitle) {
            throw new Error(`Could not find "${item.title}" in TMDb.`)
          }

          const existingDiaryEntry = await dbService.getLastWatchEntry(resolvedTitle.titleId)
          if (existingDiaryEntry) {
            updateItem(item.id, {
              importStatus: 'skipped',
              importError: 'Already exists in your diary.',
            })
            skippedCount += 1
          } else if (
            resolvedTitle.mediaType === 'movie' ||
            !item.tvEpisodes ||
            item.tvEpisodes.length === 0
          ) {
            if (item.rating === null) {
              throw new Error(`"${item.title}" needs a rating before it can be imported.`)
            }
            if (item.rating < 0 || item.rating > 5) {
              throw new Error(`"${item.title}" has a rating outside Kino's 0-5 scale.`)
            }

            const watchedAt = new Date(item.watchedAt)
            if (Number.isNaN(watchedAt.getTime())) {
              throw new Error(`"${item.title}" is missing a valid watched date.`)
            }
            await dbService.rateTitle(
              resolvedTitle.titleId,
              item.rating,
              item.watchType,
              watchedAt,
              item.notes
            )
            await dbService.addWatchDiaryEntry(
              resolvedTitle.titleId,
              watchedAt,
              item.watchType,
              item.notes
            )
            updateItem(item.id, { importStatus: 'success', importError: undefined })
            importedCount += 1
          } else {
            const episodes = item.tvEpisodes || []
            for (const episode of episodes) {
              const episodeRating = episode.rating ?? item.rating
              if (episodeRating === null) {
                throw new Error(`"${item.title}" needs a rating before it can be imported.`)
              }
              if (episodeRating < 0 || episodeRating > 5) {
                throw new Error(`"${item.title}" has a rating outside Kino's 0-5 scale.`)
              }

              const watchedAt = new Date(episode.watchedAt)
              if (Number.isNaN(watchedAt.getTime())) {
                throw new Error(`"${item.title}" is missing a valid watched date.`)
              }

              await dbService.rateEpisode(
                resolvedTitle.titleId,
                episode.seasonNumber,
                episode.episodeNumber,
                episodeRating,
                episode.watchType,
                watchedAt,
                item.notes
              )
            }

            const diaryWatchedAt = new Date(item.watchedAt)
            if (Number.isNaN(diaryWatchedAt.getTime())) {
              throw new Error(`"${item.title}" is missing a valid watched date.`)
            }
            await dbService.addWatchDiaryEntry(
              resolvedTitle.titleId,
              diaryWatchedAt,
              item.watchType,
              item.notes
            )
            updateItem(item.id, { importStatus: 'success', importError: undefined })
            importedCount += 1
          }
        } catch (error) {
          console.error(`[Import] Item import failed for: ${item.title}`, error)
          const errorMsg = error instanceof Error ? error.message : 'Import failed'
          // Mark item as failed
          updateItem(item.id, { importStatus: 'failed', importError: errorMsg })
          failureCount += 1
        }

        setProgress({
          completed: index + 1,
          total: includedItems.length,
          imported: importedCount,
          skipped: skippedCount,
          failed: failureCount,
        })
      }

      Alert.alert(
        'Import finished',
        `Imported: ${importedCount}\nSkipped: ${skippedCount}\nFailed: ${failureCount}`
      )
    } catch (globalError) {
      console.error('[Import] Global import failure', globalError)
      Alert.alert('Import failed', 'An unexpected error occurred during the import process.')
    } finally {
      setImporting(false)
    }
  }

  const allItems = state.items
  const hasItems = allItems.length > 0

  const ITEMS_PER_PAGE = 15
  const totalPages = Math.max(1, Math.ceil(allItems.length / ITEMS_PER_PAGE))
  const paginatedItems = useMemo(() => {
    return allItems.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
  }, [allItems, page])

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
          data={paginatedItems}
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
                    {progress.completed} of {progress.total} processed
                  </Text>
                  <Text className="mt-2 text-xs font-medium text-text-secondary">
                    Imported: {progress.imported} | Skipped: {progress.skipped} | Failed:{' '}
                    {progress.failed}
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

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <View className="mb-4 flex-row items-center justify-between rounded-2xl border border-white/5 bg-surface p-3">
                  <TouchableOpacity
                    className={`rounded-xl px-4 py-2 ${page === 1 ? 'opacity-40' : 'bg-white/5'}`}
                    onPress={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <Text className="text-sm font-semibold text-text-primary">Previous</Text>
                  </TouchableOpacity>

                  <Text className="text-sm text-text-secondary font-medium">
                    Page {page} of {totalPages}
                  </Text>

                  <TouchableOpacity
                    className={`rounded-xl px-4 py-2 ${page === totalPages ? 'opacity-40' : 'bg-white/5'}`}
                    onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <Text className="text-sm font-semibold text-text-primary">Next</Text>
                  </TouchableOpacity>
                </View>
              )}

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
  const watchedAtText = useMemo(() => formatDate(item.watchedAt), [item.watchedAt])

  let cardBorderColor = 'border-white/5'
  let cardBgColor = item.include ? 'bg-surface' : 'bg-surface/60 opacity-60'

  if (item.importStatus === 'success') {
    cardBorderColor = 'border-[#1DB954]/40'
    cardBgColor = 'bg-[#1DB954]/5'
  } else if (item.importStatus === 'skipped') {
    cardBorderColor = 'border-orange-500/40'
    cardBgColor = 'bg-orange-500/5'
  } else if (item.importStatus === 'failed') {
    cardBorderColor = 'border-red-500/40'
    cardBgColor = 'bg-red-500/5'
  }

  return (
    <View
      className={`mx-4 mb-3 rounded-2xl border p-4 ${cardBorderColor} ${cardBgColor}`}
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
          onPress={() => {
            if (
              item.importStatus !== 'success' &&
              item.importStatus !== 'skipped' &&
              item.importStatus !== 'processing'
            ) {
              onToggleInclude(!item.include)
            }
          }}
          disabled={
            item.importStatus === 'success' ||
            item.importStatus === 'skipped' ||
            item.importStatus === 'processing'
          }
        >
          {item.importStatus === 'success' ? (
            <Ionicons name="checkmark-circle" size={22} color="#1DB954" />
          ) : item.importStatus === 'skipped' ? (
            <Ionicons name="play-skip-forward-circle" size={22} color="#fb923c" />
          ) : item.importStatus === 'failed' ? (
            <Ionicons name="close-circle" size={22} color="#ef4444" />
          ) : item.importStatus === 'processing' ? (
            <ActivityIndicator size="small" color="#1DB954" />
          ) : (
            <Ionicons
              name={item.include ? 'checkbox-outline' : 'square-outline'}
              size={20}
              color={item.include ? '#1DB954' : '#888'}
            />
          )}
        </TouchableOpacity>
      </View>

      {item.importStatus === 'failed' ? (
        <View className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 flex-row items-center gap-2">
          <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-red-200">Failed to import</Text>
            <Text className="mt-0.5 text-xs text-red-300">
              {item.importError || `Could not find "${item.title}" in TMDb.`}
            </Text>
          </View>
        </View>
      ) : null}

      {item.importStatus === 'success' ? (
        <View className="mt-3 rounded-xl border border-green-500/40 bg-[#1DB954]/10 px-3 py-2 flex-row items-center gap-2">
          <Ionicons name="checkmark-circle-outline" size={16} color="#1DB954" />
          <Text className="text-sm font-semibold text-green-200">Imported successfully</Text>
        </View>
      ) : null}

      {item.importStatus === 'skipped' ? (
        <View className="mt-3 flex-row items-center gap-2 rounded-xl border border-orange-500/40 bg-orange-500/10 px-3 py-2">
          <Ionicons name="play-skip-forward-outline" size={16} color="#fb923c" />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-orange-200">
              Skipped (Already exists)
            </Text>
            <Text className="mt-0.5 text-xs text-orange-300">
              {item.importError || 'Already exists in your diary.'}
            </Text>
          </View>
        </View>
      ) : null}

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
            editable={
              item.importStatus !== 'success' &&
              item.importStatus !== 'skipped' &&
              item.importStatus !== 'processing'
            }
          />
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Text className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-text-secondary">
              Watched on
            </Text>
            <TouchableOpacity
              className="rounded-xl border border-white/5 bg-primary px-3 py-3"
              onPress={() => {
                if (
                  item.importStatus !== 'success' &&
                  item.importStatus !== 'skipped' &&
                  item.importStatus !== 'processing'
                ) {
                  onDatePress(datePickerId === item.id ? null : item.id)
                }
              }}
              disabled={
                item.importStatus === 'success' ||
                item.importStatus === 'skipped' ||
                item.importStatus === 'processing'
              }
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
              editable={
                item.importStatus !== 'success' &&
                item.importStatus !== 'skipped' &&
                item.importStatus !== 'processing'
              }
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
              onPress={() => {
                if (
                  item.importStatus !== 'success' &&
                  item.importStatus !== 'skipped' &&
                  item.importStatus !== 'processing'
                ) {
                  onChange(item.id, { watchType: 'first-time' })
                }
              }}
            />
            <SegmentButton
              label="Rewatch"
              active={item.watchType === 'rewatch'}
              onPress={() => {
                if (
                  item.importStatus !== 'success' &&
                  item.importStatus !== 'skipped' &&
                  item.importStatus !== 'processing'
                ) {
                  onChange(item.id, { watchType: 'rewatch' })
                }
              }}
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

function cleanSearchTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ') // remove parentheses like (2020)
    .replace(/[^a-zA-Z0-9\s]/g, ' ') // remove special chars
    .replace(/\s+/g, ' ') // normalize whitespace
    .trim()
}

function stripLeadingArticles(title: string): string {
  return title
    .replace(/^(the|a|an|la|le|el|os|as|o|a)\s+/i, '')
    .trim()
}

async function resolveTitleId(
  item: ImportTitleItem,
  onMediaTypeChange: (id: string, newMediaType: 'movie' | 'tv') => void
): Promise<{ titleId: string; mediaType: 'movie' | 'tv' } | null> {
  const tmdb = getTMDbService()

  // Helper to search and choose candidate
  const searchAndMatch = async (query: string, mediaType: 'movie' | 'tv'): Promise<{ id: number; mediaType: 'movie' | 'tv' } | null> => {
    try {
      const searchResult = await tmdb.search(query)
      if (!searchResult || !searchResult.results) return null

      // 1. Try primary media type
      const primaryCandidates = searchResult.results.filter((result) => result.media_type === mediaType)
      let chosen = chooseBestCandidate(item, primaryCandidates)
      if (chosen) return { id: chosen.id, mediaType }

      // 2. Try opposite media type
      const oppositeMediaType = mediaType === 'movie' ? 'tv' : 'movie'
      const oppositeCandidates = searchResult.results.filter((result) => result.media_type === oppositeMediaType)
      chosen = chooseBestCandidate(item, oppositeCandidates)
      if (chosen) return { id: chosen.id, mediaType: oppositeMediaType }
    } catch (err) {
      console.warn(`[Import] Search failed for query "${query}":`, err)
    }
    return null
  }

  // Phase 1: Search with original title
  let match = await searchAndMatch(item.title.trim(), item.mediaType)

  // Phase 2: Search with cleaned title
  if (!match) {
    const cleanedTitle = cleanSearchTitle(item.title)
    if (cleanedTitle && cleanedTitle !== item.title.trim()) {
      match = await searchAndMatch(cleanedTitle, item.mediaType)
    }
  }

  // Phase 3: Search without common leading articles
  if (!match) {
    const noArticlesTitle = stripLeadingArticles(item.title)
    if (noArticlesTitle && noArticlesTitle !== item.title.trim()) {
      match = await searchAndMatch(noArticlesTitle, item.mediaType)
    }
  }

  if (!match) {
    return null
  }

  // If media type was swapped, notify parent to update the item state
  if (match.mediaType !== item.mediaType) {
    onMediaTypeChange(item.id, match.mediaType)
  }

  if (match.mediaType === 'movie') {
    const details = await tmdb.getMovieDetails(match.id)
    const credits = await tmdb.getMovieCredits(match.id)
    const transformed = await transformMovieToTitleDetails(details, credits)
    return {
      titleId: await dbService.getOrCreateTitle(transformed),
      mediaType: match.mediaType,
    }
  } else {
    const details = await tmdb.getTVDetails(match.id)
    const credits = await tmdb.getTVCredits(match.id)
    const transformed = await transformTVToTitleDetails(details, credits)
    return {
      titleId: await dbService.getOrCreateTitle(transformed),
      mediaType: match.mediaType,
    }
  }
}

function chooseBestCandidate(
  item: ImportTitleItem,
  candidates: Array<{
    id: number
    title?: string
    name?: string
    original_title?: string
    original_name?: string
    release_date?: string
    first_air_date?: string
  }>
): { id: number } | null {
  const normalizedTarget = normalizeText(item.title)

  const scored = candidates
    .map((candidate) => {
      const candidateTitle = normalizeText(candidate.title || candidate.name || '')
      const candidateOriginal = normalizeText(candidate.original_title || candidate.original_name || '')
      const candidateYear = parseYear(candidate.release_date || candidate.first_air_date || '')
      let score = 0

      if (candidateTitle === normalizedTarget || candidateOriginal === normalizedTarget) {
        score += 10
      } else if (
        candidateTitle.includes(normalizedTarget) ||
        normalizedTarget.includes(candidateTitle) ||
        candidateOriginal.includes(normalizedTarget) ||
        normalizedTarget.includes(candidateOriginal)
      ) {
        score += 5
      }
      if (item.year && candidateYear === item.year) {
        score += 4
      }
      return { id: candidate.id, score }
    })
    .sort((left, right) => right.score - left.score)

  if (scored.length === 0) return null
  return { id: scored[0].id }
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
