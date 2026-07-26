import type { CSSProperties, ReactNode } from 'react'

type CoverImage = string | ArrayBuffer

const canvas: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  display: 'flex',
  overflow: 'hidden',
  background: '#121212',
}

export function WatchlistProfileCover({ images }: { images: Array<CoverImage | null> }) {
  const posters = images.filter((image): image is CoverImage => Boolean(image))

  return (
    <div style={canvas}>
      {posters.length === 0 ? <EmptyCover /> : <PosterLayout posters={posters.slice(0, 6)} />}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.12))',
        }}
      />
    </div>
  )
}

function PosterLayout({ posters }: { posters: CoverImage[] }) {
  if (posters.length === 1) return <Poster image={posters[0]!} />

  if (posters.length === 2) {
    return (
      <Row>
        {posters.map((image, index) => (
          <Poster height="100%" image={image} key={index} width="50%" />
        ))}
      </Row>
    )
  }

  if (posters.length === 3) {
    return (
      <Row>
        <Poster height="100%" image={posters[0]!} width="50%" />
        <div style={{ display: 'flex', width: '50%', height: '100%', flexDirection: 'column' }}>
          <Poster height="50%" image={posters[1]!} />
          <Poster height="50%" image={posters[2]!} />
        </div>
      </Row>
    )
  }

  const tileCount = posters.length === 4 ? 4 : 6
  const tiles = Array.from({ length: tileCount }, (_, index) => posters[index % posters.length])
  return (
    <Row wrap>
      {tiles.map((image, index) => (
        <Poster
          height={tileCount === 4 ? '50%' : '33.34%'}
          image={image!}
          key={index}
          width="50%"
        />
      ))}
    </Row>
  )
}

function Row({ children, wrap = false }: { children: ReactNode; wrap?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        flexWrap: wrap ? 'wrap' : 'nowrap',
      }}
    >
      {children}
    </div>
  )
}

function Poster({
  height = '100%',
  image,
  width = '100%',
}: {
  height?: string
  image: CoverImage
  width?: string
}) {
  return <img alt="" src={image as string} style={{ width, height, objectFit: 'cover' }} />
}

function EmptyCover() {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(circle at 50% 42%, rgba(29,185,84,0.14), transparent 38%), linear-gradient(145deg, #171a18, #0d0f0e)',
      }}
    >
      <div
        style={{
          width: 250,
          height: 250,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          border: '3px solid rgba(29,185,84,0.48)',
          background: 'rgba(0,0,0,0.24)',
        }}
      >
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              width: 54,
              height: 54,
              display: 'flex',
              borderRadius: 999,
              background: 'rgba(29,185,84,0.22)',
              transform: `rotate(${index * 90}deg) translateY(-72px)`,
            }}
          />
        ))}
        <div
          style={{
            width: 38,
            height: 38,
            display: 'flex',
            borderRadius: 999,
            background: '#1db954',
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 28,
          right: 28,
          top: 44,
          height: 18,
          display: 'flex',
          borderTop: '2px solid rgba(255,255,255,0.10)',
          borderBottom: '2px solid rgba(255,255,255,0.10)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 28,
          right: 28,
          bottom: 44,
          height: 18,
          display: 'flex',
          borderTop: '2px solid rgba(255,255,255,0.10)',
          borderBottom: '2px solid rgba(255,255,255,0.10)',
        }}
      />
    </div>
  )
}
