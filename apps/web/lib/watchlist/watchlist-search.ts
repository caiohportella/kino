function normalizeSearchValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
}

export function filterWatchlistItemsByTitle<T extends { title: string }>(
  items: T[],
  query: string
): T[] {
  const normalizedQuery = normalizeSearchValue(query.trim())

  if (!normalizedQuery) {
    return items
  }

  return items.filter((item) => normalizeSearchValue(item.title).includes(normalizedQuery))
}
