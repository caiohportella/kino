import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Kino - a calm movie and series tracking companion'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          overflow: 'hidden',
          background:
            'radial-gradient(circle at 20% 20%, rgba(29,185,84,0.28), transparent 34%), radial-gradient(circle at 80% 78%, rgba(34,197,94,0.14), transparent 28%), linear-gradient(135deg, #0d0e0f 0%, #111314 45%, #171717 100%)',
          color: '#f3f3f0',
          fontFamily: 'Aptos, Helvetica Neue, Arial, sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: '-12% -6% auto auto',
            width: 480,
            height: 480,
            borderRadius: 999,
            background: 'radial-gradient(circle, rgba(29,185,84,0.18) 0%, rgba(29,185,84,0.04) 42%, transparent 72%)',
            filter: 'blur(8px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 'auto auto -16% -10%',
            width: 420,
            height: 420,
            borderRadius: 999,
            background: 'radial-gradient(circle, rgba(255,255,255,0.09) 0%, transparent 68%)',
            filter: 'blur(8px)',
          }}
        />

        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '72px 72px',
            maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.48), transparent 72%)',
            opacity: 0.25,
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            width: '100%',
            height: '100%',
            padding: 72,
            gap: 60,
          }}
        >
          <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  display: 'flex',
                  width: 72,
                  height: 72,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 20,
                  border: '1px solid rgba(255,255,255,0.14)',
                  background: 'linear-gradient(145deg, rgba(255,255,255,0.08), rgba(29,185,84,0.08))',
                  boxShadow: '0 18px 40px rgba(0,0,0,0.28)',
                  fontSize: 34,
                  fontWeight: 800,
                  color: '#ffffff',
                }}
              >
                K
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.68)' }}>
                  Kino
                </div>
                <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.56)' }}>Movie and series tracking</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 670 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  width: 'fit-content',
                  borderRadius: 999,
                  border: '1px solid rgba(29,185,84,0.3)',
                  background: 'rgba(29,185,84,0.12)',
                  padding: '10px 16px',
                  color: '#baf5cf',
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                Calm, focused, premium
              </div>
              <div style={{ fontSize: 74, lineHeight: 0.96, letterSpacing: '-0.04em', fontWeight: 800 }}>
                Track every movie and series in one calm home.
              </div>
              <div style={{ fontSize: 30, lineHeight: 1.35, color: 'rgba(255,255,255,0.76)', maxWidth: 620 }}>
                Diary entries, ratings, episode progress, and shared watchlists stay organized across web and mobile.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', maxWidth: 620 }}>
              {['Discover', 'Diary', 'Watchlists', 'Ratings'].map((label) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 136,
                    minHeight: 54,
                    borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.04)',
                    color: '#f5f5f3',
                    fontSize: 20,
                    fontWeight: 700,
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', width: 420, alignItems: 'center', justifyContent: 'center' }}>
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: 470,
                borderRadius: 28,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(0,0,0,0.2))',
                boxShadow: '0 28px 80px rgba(0,0,0,0.4)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'radial-gradient(circle at 30% 30%, rgba(29,185,84,0.28), transparent 24%), radial-gradient(circle at 80% 18%, rgba(255,255,255,0.14), transparent 20%), linear-gradient(180deg, rgba(14,15,16,0.4), rgba(14,15,16,0.78))',
                }}
              />
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 14, padding: 24 }}>
                <CardMock title="Tonight" badge="4.5" accent />
                <CardMock title="Keep watching" badge="08" />
                <CardMock title="Shared queue" badge="12" />
                <div
                  style={{
                    marginTop: 14,
                    display: 'flex',
                    gap: 14,
                  }}
                >
                  <Pill text="Episodes" />
                  <Pill text="Trailers" />
                  <Pill text="Casting" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}

function CardMock({ title, badge, accent = false }: { title: string; badge: string; accent?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 18,
        borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.1)',
        background: accent ? 'rgba(29,185,84,0.12)' : 'rgba(255,255,255,0.04)',
        padding: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <div
          style={{
            width: 54,
            height: 72,
            borderRadius: 14,
            background: accent
              ? 'linear-gradient(145deg, rgba(29,185,84,0.46), rgba(255,255,255,0.08))'
              : 'linear-gradient(145deg, rgba(255,255,255,0.18), rgba(0,0,0,0.16))',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f5f5f3' }}>{title}</div>
          <div style={{ marginTop: 6, width: 160, height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.12)' }} />
          <div style={{ marginTop: 8, width: 120, height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.08)' }} />
        </div>
      </div>
      <div
        style={{
          minWidth: 58,
          height: 58,
          padding: '0 16px',
          borderRadius: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: accent ? '#1db954' : 'rgba(255,255,255,0.08)',
          color: accent ? '#050505' : '#f5f5f3',
          fontSize: 22,
          fontWeight: 800,
        }}
      >
        {badge}
      </div>
    </div>
  )
}

function Pill({ text }: { text: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.05)',
        padding: '10px 16px',
        fontSize: 18,
        fontWeight: 700,
        color: 'rgba(255,255,255,0.84)',
      }}
    >
      {text}
    </div>
  )
}
