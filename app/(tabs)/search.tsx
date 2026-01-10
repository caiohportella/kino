import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, ScrollView, TouchableOpacity, LayoutAnimation, Platform, UIManager, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SearchBar } from '~/components/SearchBar';
import { TitleCard } from '~/components/TitleCard';
import { GenreBadge } from '~/components/GenreBadge';
import { useSearch } from '~/hooks/useSearch';
import { useUpstashSearch } from '~/hooks/useUpstashSearch';
import { getTMDbService } from '~/services/tmdb';
import type { TMDbTitle, TMDbGenre } from '~/types';
import { ScreenHeader } from '~/components/ScreenHeader';
import { TextInput } from 'react-native-gesture-handler';


export default function SearchScreen() {
    const { results: tmdbResults, loading: tmdbLoading, search: tmdbSearch, clearResults: clearTmdbResults } = useSearch();
    const { results: semanticResults, loading: semanticLoading, search: semanticSearch, clearResults: clearSemanticResults } = useUpstashSearch();
    const { width } = useWindowDimensions();

    // Responsive Grid
    const numColumns = width > 768 ? 5 : width > 480 ? 4 : 3;
    const padding = 16;

    const [genres, setGenres] = useState<TMDbGenre[]>([]);

    // Multi-select states
    const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
    const [selectedThemes, setSelectedThemes] = useState<string[]>([]);

    const [discoveryResults, setDiscoveryResults] = useState<TMDbTitle[]>([]);
    const [loading, setLoading] = useState(false);
    const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');

    // Search state
    const [searchQuery, setSearchQuery] = useState('');

    const tmdb = getTMDbService();

    const isHybridSearchActive = searchQuery.length > 0 || selectedThemes.length > 0;
    const isGlobalLoading = loading || tmdbLoading || semanticLoading;

    // Load genres on mount
    useEffect(() => {
        const loadGenres = async () => {
            try {
                const movieGenres = await tmdb.getGenres('movie');
                const tvGenres = await tmdb.getGenres('tv');
                const merged = [...movieGenres];
                tvGenres.forEach(genre => {
                    if (!merged.find(g => g.id === genre.id)) merged.push(genre);
                });
                setGenres(merged.sort((a, b) => a.name.localeCompare(b.name)));
            } catch (err) {
                console.error('Failed to load genres:', err);
            }
        };
        loadGenres();
    }, []);

    // Hybrid Search / Discovery Trigger
    useEffect(() => {
        const executeSearch = async () => {
            // 1. Semantic Search (Text OR Themes active)
            if (isHybridSearchActive) {
                // Construct semantic query
                const genreNames = genres
                    .filter(g => selectedGenres.includes(g.id))
                    .map(g => g.name);

                let constructedQuery = searchQuery;

                // Append context to the query
                if (selectedThemes.length > 0) {
                    constructedQuery += ` ${selectedThemes.join(' ')}`;
                }
                if (genreNames.length > 0) {
                    constructedQuery += ` ${genreNames.join(' ')}`;
                }

                constructedQuery += ` ${mediaType}`; // Bias towards media type

                // Fire both searches for robust results
                semanticSearch(constructedQuery);
                tmdbSearch(searchQuery);
            }
            // 2. Standard Discovery (Only Genres or No Filter)
            else if (selectedGenres.length > 0) {
                setLoading(true);
                clearSemanticResults();
                clearTmdbResults();
                try {
                    const data = await tmdb.discoverMedia(mediaType, {
                        with_genres: selectedGenres.join(','),
                        sort_by: 'popularity.desc'
                    });
                    setDiscoveryResults(data);
                } catch (e) { console.error(e); }
                finally { setLoading(false); }
            }
            // 3. Default Popular/Trending (No Filters)
            else {
                setLoading(true);
                clearSemanticResults();
                clearTmdbResults();
                try {
                    // Just load popular if nothing selected
                    const data = await tmdb.getTrending(mediaType, 'week');
                    setDiscoveryResults(data);
                } catch (e) { console.error(e); }
                finally { setLoading(false); }
            }
        };

        const timeoutId = setTimeout(() => {
            executeSearch();
        }, 500); // Debounce everything slightly to avoid flicker

        return () => clearTimeout(timeoutId);

    }, [searchQuery, selectedGenres, selectedThemes, mediaType, isHybridSearchActive, genres]);


    // Handlers
    const handleSearchInput = (text: string) => {
        setSearchQuery(text);
    };

    const toggleGenre = (id: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        if (selectedGenres.includes(id)) {
            setSelectedGenres(prev => prev.filter(g => g !== id));
        } else {
            setSelectedGenres(prev => [...prev, id]);
        }
    };

    const toggleTheme = (theme: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        if (selectedThemes.includes(theme)) {
            setSelectedThemes(prev => prev.filter(t => t !== theme));
        } else {
            setSelectedThemes(prev => [...prev, theme]);
        }
    };

    // Determine what to show
    // If we have semantic results, show them.
    // If not, but we have TMDb results (from the fallback search), show them.
    // Otherwise show discovery results (trends/genres) if no search is active.
    const activeResults = isHybridSearchActive
        ? (semanticResults.length > 0 ? semanticResults : tmdbResults)
        : discoveryResults;

    return (
        <View className="flex-1 bg-primary justify-start">

            <ScreenHeader
                title="Search"
            />

            <SearchBar
                onSearch={handleSearchInput}
            />

            {/* 2. Media Type Toggle (Segmented Control Style) */}
            <View className="px-4 pb-4">
                <View className="flex-row bg-surface rounded-lg p-1 border border-zinc-800">
                    {['movie', 'tv'].map((type) => (
                        <TouchableOpacity
                            key={type}
                            onPress={() => setMediaType(type as 'movie' | 'tv')}
                            className={`flex-1 py-1.5 rounded-lg items-center justify-center ${mediaType === type ? 'bg-accent' : 'bg-transparent'}`}
                        >
                            <Text className={`capitalize font-semibold ${mediaType === type ? 'text-white' : 'text-zinc-400'}`}>
                                {type === 'movie' ? 'Movies' : 'TV Shows'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* 3. Filter Row (Themes + Genres) */}
            <View className="mb-6 h-10 mt-2 flex-row pl-4 items-center">
                {selectedGenres.length > 0 && (
                    <TouchableOpacity
                        onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setSelectedGenres([]);
                        }}
                        className="mr-2 flex-row items-center justify-center bg-red-500/20 w-8 h-8 rounded-full border border-red-500/50"
                    >
                        <Ionicons name="close-circle" size={18} color="#ef4444" />
                    </TouchableOpacity>
                )}

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingRight: 16, alignItems: 'center' }}
                    className="flex-1"
                >
                    {genres.map(genre => (
                        <GenreBadge
                            key={genre.id}
                            name={genre.name}
                            isActive={selectedGenres.includes(genre.id)}
                            onPress={() => toggleGenre(genre.id)}
                        />
                    ))}
                </ScrollView>
            </View>

            {/* 4. Results Grid */}
            <View className="flex-1">
                {isGlobalLoading && activeResults.length === 0 ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator size="large" color="#1DB954" />
                        <Text className="text-zinc-500 mt-4 font-medium">Finding the perfect match...</Text>
                    </View>
                ) : (
                    <FlatList
                        key={numColumns} // Force re-render on column change
                        data={activeResults}
                        keyExtractor={(item, index) => `${item.id}-${index}`}
                        numColumns={numColumns}
                        contentContainerStyle={{ paddingHorizontal: padding, paddingBottom: 100 }}
                        columnWrapperStyle={{ justifyContent: 'space-between' }}
                        renderItem={({ item }) => (
                            <View style={{ width: (width - padding * 2 - (padding / 2) * (numColumns - 1)) / numColumns, marginBottom: padding / 2 }}>
                                <TitleCard title={{ ...item, media_type: mediaType }} />
                            </View>
                        )}
                        ListEmptyComponent={
                            !isGlobalLoading ? (
                                <View className="flex-1 items-center justify-center mt-20">
                                    <Ionicons name="search-outline" size={48} color="#333" />
                                    <Text className="text-white text-lg font-bold mt-4">No results found</Text>
                                    <Text className="text-zinc-500 text-center px-8 mt-2">
                                        Try adjusting filters or searching for something else.
                                    </Text>
                                </View>
                            ) : <View>
                                <ActivityIndicator size="large" color="#1DB954" />
                                <Text className="text-zinc-500 mt-4 font-medium">Finding the perfect match...</Text>
                            </View>
                        }
                    />
                )}
            </View>

        </View>
    );
}
