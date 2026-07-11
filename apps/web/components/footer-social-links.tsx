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

export function FooterSocialLinks({
  navigationLabel = 'Social and app stores',
}: {
  navigationLabel?: string
}) {
  return (
    <nav aria-label={navigationLabel} className="flex items-center gap-2">
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
  )
}
