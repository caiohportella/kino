import type { PublicWatchlistSummary } from '@kino/core'
import type { TitleCardItem } from '../components/title-card'

export function normalizeProfileWatchlistCard(
  watchlist: PublicWatchlistSummary,
  presentation: { count: string; href: string; imageUrl: string }
): TitleCardItem {
  return {
    href: presentation.href,
    id: watchlist.id,
    imageAlt: watchlist.name,
    imageUrl: presentation.imageUrl,
    subtitle: presentation.count,
    title: watchlist.name,
  }
}
