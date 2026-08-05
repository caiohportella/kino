type TitleIdentityGenre = {
  readonly id: number
  readonly name: string
}

type TitleIdentityMetadataInput = {
  readonly genres: readonly TitleIdentityGenre[]
  readonly year: number | null | undefined
}

export type TitleIdentityMetadataItem = {
  readonly key: string
  readonly label: string
}

export function buildTitleIdentityMetadata({
  genres,
  year,
}: TitleIdentityMetadataInput): TitleIdentityMetadataItem[] {
  const genreItems = genres.slice(0, 2).map((genre) => ({
    key: `genre-${genre.id}`,
    label: genre.name,
  }))

  return year ? [{ key: 'year', label: String(year) }, ...genreItems] : genreItems
}
