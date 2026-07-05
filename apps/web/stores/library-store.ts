'use client'

import type { MediaType } from '@kino/core'
import { create } from 'zustand'

export type LibraryLayout = 'grid' | 'list'

interface LibraryFilters {
  query: string
  mediaType: MediaType | 'all'
  minRating: number
  genreIds: number[]
  layout: LibraryLayout
  setQuery: (query: string) => void
  setMediaType: (mediaType: MediaType | 'all') => void
  setMinRating: (rating: number) => void
  toggleGenre: (id: number) => void
  setLayout: (layout: LibraryLayout) => void
  clearFilters: () => void
}

export const useLibraryStore = create<LibraryFilters>((set) => ({
  query: '',
  mediaType: 'all',
  minRating: 0,
  genreIds: [],
  layout: 'grid',
  setQuery: (query) => set({ query }),
  setMediaType: (mediaType) => set({ mediaType }),
  setMinRating: (minRating) => set({ minRating }),
  toggleGenre: (id) =>
    set((state) => ({
      genreIds: state.genreIds.includes(id)
        ? state.genreIds.filter((current) => current !== id)
        : [...state.genreIds, id],
    })),
  setLayout: (layout) => set({ layout }),
  clearFilters: () => set({ query: '', mediaType: 'all', minRating: 0, genreIds: [] }),
}))
