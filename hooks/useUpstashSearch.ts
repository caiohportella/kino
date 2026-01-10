import { useState, useCallback, useRef } from 'react';
import { semanticSearch, SemanticSearchResult } from '../services/upstash';

export function useUpstashSearch() {
    const [results, setResults] = useState<SemanticSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const search = useCallback((query: string) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        if (!query.trim()) {
            setResults([]);
            return;
        }

        setLoading(true);
        setError(null);

        // Debounce the search
        timeoutRef.current = setTimeout(async () => {
            try {
                const data = await semanticSearch(query);
                setResults(data);
            } catch (err) {
                setError(err instanceof Error ? err : new Error('Semantic search failed'));
                // Keep previous results or clear? Let's keep them but show error state if needed
            } finally {
                setLoading(false);
            }
        }, 500); // 500ms debounce
    }, []);

    const clearResults = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setResults([]);
        setLoading(false);
    }, []);

    return {
        results,
        loading,
        error,
        search,
        clearResults,
    };
}
