type LocalizableGenre = {
  id?: number | null
  name: string
}

type TranslateGenre = (
  key: string,
  options?: {
    defaultValue?: string
  }
) => string

export function getLocalizedGenreName(genre: LocalizableGenre, t: TranslateGenre): string {
  if (genre.id == null) return genre.name

  return t(`genres.${genre.id}`, {
    defaultValue: genre.name,
  })
}
