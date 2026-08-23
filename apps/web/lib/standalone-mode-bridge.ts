export const STANDALONE_MODE_ATTRIBUTE = 'data-standalone-mode'
export const STANDALONE_MODE_MEDIA_QUERY = '(display-mode: standalone)'

export function setStandaloneModeAttribute(
  documentLike: Pick<Document, 'documentElement'> | undefined,
  standalone: boolean
) {
  documentLike?.documentElement.setAttribute(
    STANDALONE_MODE_ATTRIBUTE,
    standalone ? 'true' : 'false'
  )
}

export function readStandaloneModeAttribute(
  documentLike: Pick<Document, 'documentElement'> | undefined
) {
  return documentLike?.documentElement.getAttribute(STANDALONE_MODE_ATTRIBUTE) === 'true'
}

export function getStandaloneModeBootstrapScript() {
  return `(() => {
    try {
      const standaloneQuery = typeof window.matchMedia === "function"
        ? window.matchMedia("${STANDALONE_MODE_MEDIA_QUERY}")
        : null;
      document.documentElement.setAttribute("${STANDALONE_MODE_ATTRIBUTE}", standaloneQuery?.matches || navigator.standalone ? "true" : "false");
    } catch {
      document.documentElement.setAttribute("${STANDALONE_MODE_ATTRIBUTE}", "false");
    }
  })();`
}
