import Link from 'next/link'

const footerLinks = [
  {
    href: 'https://www.instagram.com/',
    icon: 'https://cdn.simpleicons.org/instagram/E4405F',
    label: 'Instagram',
  },
  {
    href: 'https://x.com/',
    icon: 'https://cdn.simpleicons.org/x/FFFFFF',
    label: 'X',
  },
  {
    href: 'https://play.google.com/store/apps/details?id=com.googleauth.kinoandroid',
    icon: 'https://cdn.simpleicons.org/googleplay/34A853',
    label: 'Google Play',
  },
  {
    href: 'https://www.apple.com/app-store/',
    icon: 'https://cdn.simpleicons.org/appstore/0D96F6',
    label: 'Apple App Store',
  },
] as const

export function AppFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-white/[0.06] py-5">
      <div className="content-frame flex flex-col gap-4 px-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="grid gap-1">
          <Link className="w-fit text-lg font-black italic tracking-normal text-kino-text" href="/discover">
            Kino<span className="text-kino-accent">.</span>
          </Link>
          <p className="text-xs text-kino-muted">© {currentYear} Kino</p>
        </div>

        <p className="text-xs text-kino-muted sm:text-center">
          Film and TV metadata provided by{' '}
          <a
            className="font-semibold text-kino-text hover:underline"
            href="https://www.themoviedb.org/"
            rel="noreferrer"
            target="_blank"
          >
            TMDB
          </a>
          .
        </p>

        <nav aria-label="Social and app stores" className="flex items-center gap-2">
          {footerLinks.map((link) => (
            <a
              aria-label={link.label}
              className="group grid size-9 place-items-center rounded-md text-kino-muted transition-opacity hover:opacity-100 focus-ring"
              href={link.href}
              key={link.label}
              rel="noreferrer"
              target="_blank"
              title={link.label}
            >
              <img
                alt=""
                className="size-4 object-contain opacity-55 grayscale transition-[filter,opacity] group-hover:opacity-80"
                src={link.icon}
              />
            </a>
          ))}
        </nav>
      </div>
    </footer>
  )
}
