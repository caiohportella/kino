export const KINO_LOGO_PATH = "/kino-logo.png";
export const KINO_LOGO_ASPECT_RATIO = 1536 / 1024;

export function kinoLogoUrl(origin: string) {
  return new URL(KINO_LOGO_PATH, origin).toString();
}
