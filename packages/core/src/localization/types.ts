export type NormalizedLocale = string

export type CacheScope =
  | { readonly kind: 'public' }
  | { readonly kind: 'authenticated'; readonly userId: string }

export interface LocaleContext {
  readonly locale: NormalizedLocale
  readonly region: string
}
