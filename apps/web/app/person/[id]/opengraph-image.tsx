import { getDisplayTitle, getReleaseYear } from '@kino/core'
import { ImageResponse } from 'next/og'
import type { CSSProperties } from 'react'
import { getPersonSeoData } from '@/lib/server-tmdb'
import { buildPersonDescription, trimText } from '@/lib/seo'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Kino person preview'

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const personId = Number(id)

  if (!Number.isFinite(personId) || personId <= 0) {
    return new ImageResponse(<FallbackBanner title="Person not found" />, { ...size })
  }

  try {
    const person = await getPersonSeoData(personId, 'en')
    const image = person.profile_path ? `https://image.tmdb.org/t/p/w780${person.profile_path}` : null
    const credits = [...(person.combined_credits?.cast ?? []), ...(person.combined_credits?.crew ?? [])]
    const knownFor = credits
      .filter((credit) => credit.media_type === 'movie' || credit.media_type === 'tv')
      .sort(
        (left, right) =>
          (right.vote_average || 0) - (left.vote_average || 0) ||
          ((getReleaseYear(right) ?? 0) - (getReleaseYear(left) ?? 0))
      )
      .slice(0, 3)

    return new ImageResponse(
      (
        <div style={container}>
          <div style={{ ...glow, inset: '-12% -8% auto auto', background: 'radial-gradient(circle, rgba(29,185,84,0.22) 0%, rgba(29,185,84,0.04) 42%, transparent 72%)' }} />
          <div style={{ ...glow, inset: 'auto auto -18% -10%', background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 66%)' }} />
          <div style={gridOverlay} />
          <div style={overlay} />

          {image ? (
            <img
              alt=""
              src={image}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 0.18,
              }}
            />
          ) : null}

          <div style={contentWrap}>
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'space-between', gap: 42 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <BrandBadge />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={eyebrow}>Kino</div>
                  <div style={subtleLabel}>Public profile preview</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 650 }}>
                <div style={titleStyle}>{person.name}</div>
                <div style={descriptionStyle}>{buildPersonDescription(person)}</div>
                <div style={chipRow}>
                  {[
                    person.known_for_department || 'Screen presence',
                    person.birthday ? `Born ${person.birthday.slice(0, 4)}` : 'Biography and credits',
                    person.place_of_birth || 'Filmography',
                  ]
                    .filter(Boolean)
                    .map((chip) => (
                      <Chip key={chip}>{chip}</Chip>
                    ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {knownFor.map((credit) => {
                  const title = getDisplayTitle(credit)
                  const label = `${title}${getReleaseYear(credit) ? ` · ${getReleaseYear(credit)}` : ''}`
                  return <Tag key={`${credit.media_type}-${credit.id}`}>{trimText(label, 24)}</Tag>
                })}
              </div>
            </div>

            <div style={{ display: 'flex', width: 390, alignItems: 'center', justifyContent: 'center' }}>
              <div style={portraitFrame}>
                {image ? (
                  <img
                    alt=""
                    src={image}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : null}
                <div style={portraitGlow} />
                <div style={portraitContent}>
                  <div style={portraitMiniLabel}>Profile</div>
                  <div style={portraitName}>{trimText(person.name, 28)}</div>
                  <div style={portraitMeta}>{person.known_for_department}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
      { ...size }
    )
  } catch {
    return new ImageResponse(<FallbackBanner title="Kino" />, { ...size })
  }
}

function FallbackBanner({ title }: { title: string }) {
  return (
    <div style={{ ...container, padding: 72, justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 860 }}>
        <div style={{ ...eyebrow, width: 'fit-content' }}>Kino</div>
        <div style={{ fontSize: 76, lineHeight: 0.95, letterSpacing: '-0.04em', fontWeight: 800 }}>{title}</div>
        <div style={{ fontSize: 30, lineHeight: 1.35, color: 'rgba(255,255,255,0.78)' }}>Movies, series, and the people who shape them.</div>
      </div>
    </div>
  )
}

const container: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  display: 'flex',
  overflow: 'hidden',
  background:
    'radial-gradient(circle at 18% 20%, rgba(29,185,84,0.28), transparent 34%), radial-gradient(circle at 82% 72%, rgba(255,255,255,0.09), transparent 28%), linear-gradient(135deg, #0d0e0f 0%, #111314 42%, #171717 100%)',
  color: '#f3f3f0',
  fontFamily: 'Aptos, Helvetica Neue, Arial, sans-serif',
}

const glow: CSSProperties = {
  position: 'absolute',
  width: 520,
  height: 520,
  borderRadius: 999,
  filter: 'blur(8px)',
}

const gridOverlay: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
  backgroundSize: '80px 80px',
  opacity: 0.18,
  maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.52), transparent 75%)',
}

const overlay: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'linear-gradient(90deg, rgba(13,14,15,0.82) 0%, rgba(13,14,15,0.8) 42%, rgba(13,14,15,0.5) 100%)',
}

const contentWrap: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  width: '100%',
  height: '100%',
  padding: 64,
  gap: 48,
}

const eyebrow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  width: 'fit-content',
  borderRadius: 999,
  border: '1px solid rgba(29,185,84,0.28)',
  background: 'rgba(29,185,84,0.1)',
  padding: '10px 16px',
  color: '#bef7d0',
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const subtleLabel: CSSProperties = {
  marginTop: 10,
  fontSize: 18,
  color: 'rgba(255,255,255,0.62)',
}

const titleStyle: CSSProperties = {
  fontSize: 72,
  lineHeight: 0.96,
  letterSpacing: '-0.04em',
  fontWeight: 800,
}

const descriptionStyle: CSSProperties = {
  fontSize: 28,
  lineHeight: 1.35,
  color: 'rgba(255,255,255,0.78)',
  maxWidth: 620,
}

const chipRow: CSSProperties = {
  display: 'flex',
  gap: 14,
  flexWrap: 'wrap',
}

const portraitFrame: CSSProperties = {
  position: 'relative',
  width: 320,
  height: 470,
  borderRadius: 28,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(0,0,0,0.24))',
  overflow: 'hidden',
  boxShadow: '0 28px 80px rgba(0,0,0,0.42)',
}

const portraitGlow: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'linear-gradient(180deg, rgba(29,185,84,0.2) 0%, rgba(255,255,255,0.02) 44%, rgba(13,14,15,0.78) 100%)',
}

const portraitContent: CSSProperties = {
  position: 'absolute',
  left: 20,
  right: 20,
  bottom: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const portraitMiniLabel: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.72)',
}

const portraitName: CSSProperties = {
  fontSize: 32,
  lineHeight: 1,
  fontWeight: 800,
  letterSpacing: '-0.04em',
}

const portraitMeta: CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.74)',
}

function BrandBadge() {
  return (
    <div
      style={{
        display: 'flex',
        width: 68,
        height: 68,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.14)',
        background: 'linear-gradient(145deg, rgba(255,255,255,0.08), rgba(29,185,84,0.1))',
        boxShadow: '0 18px 40px rgba(0,0,0,0.28)',
        fontSize: 32,
        fontWeight: 800,
      }}
    >
      K
    </div>
  )
}

function Chip({ children }: { children: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 52,
        padding: '0 18px',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.05)',
        fontSize: 18,
        fontWeight: 700,
        color: 'rgba(255,255,255,0.88)',
      }}
    >
      {children}
    </div>
  )
}

function Tag({ children }: { children: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
        padding: '0 16px',
        borderRadius: 999,
        border: '1px solid rgba(29,185,84,0.3)',
        background: 'rgba(29,185,84,0.12)',
        color: '#bef7d0',
        fontSize: 16,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  )
}
