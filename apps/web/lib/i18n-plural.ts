export function getPluralTranslationKey(language: string, key: string, count?: number) {
  if (typeof count !== 'number' || !Number.isFinite(count)) return key
  const category = new Intl.PluralRules(language).select(count)
  return `${key}_${category}`
}
