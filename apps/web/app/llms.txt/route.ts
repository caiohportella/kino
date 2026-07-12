import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, absoluteUrl } from '@/lib/seo'

export async function GET() {
  const body = [
    `${SITE_NAME}`,
    '',
    SITE_DESCRIPTION,
    '',
    `Tagline: ${SITE_TAGLINE}`,
    '',
    'Public surfaces:',
    `- ${absoluteUrl('/')}`,
    `- ${absoluteUrl('/discover')}`,
    `- ${absoluteUrl('/search')}`,
    `- ${absoluteUrl('/title/238-the-godfather?type=movie')}`,
    `- ${absoluteUrl('/title/1399-game-of-thrones?type=tv')}`,
    `- ${absoluteUrl('/person/3084-marlon-brando')}`,
    '',
    'Private or account-specific surfaces:',
    '- /auth/login',
    '- /auth/register',
    '- /diary',
    '- /import',
    '- /settings',
    '- /watchlists',
    '- /[username]',
    '',
    'What Kino does:',
    '- Discover movies and TV series',
    '- Track diary entries, ratings, and episode progress',
    '- Organize private or shared watchlists',
    '- Browse people, credits, and title pages',
    '- Support localized browsing across web and mobile',
    '',
    `Sitemap: ${absoluteUrl('/sitemap.xml')}`,
    `Robots: ${absoluteUrl('/robots.txt')}`,
  ].join('\n')

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}
