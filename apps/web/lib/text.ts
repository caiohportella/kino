export function decodeHtmlEntities(value: string | null | undefined) {
  if (!value) return ''

  let decoded = value
  for (let pass = 0; pass < 2; pass += 1) {
    decoded = decoded
      .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) =>
        String.fromCodePoint(Number.parseInt(code, 16))
      )
      .replace(/&#(\d+);/g, (_match, code: string) =>
        String.fromCodePoint(Number.parseInt(code, 10))
      )
      .replace(/&apos;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&')
  }
  return decoded
}

export function socialMetadataText(value: string | null | undefined) {
  return decodeHtmlEntities(value).replace(/'/g, '’')
}
