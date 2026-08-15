import { createElement } from 'react'
import { KinoLogo } from '@/components/kino-logo'

export type StoryImageData = string | ArrayBuffer | null

export type StoryFeaturedItem = {
  imageSrc: StoryImageData
  label: string
  meta: string | null
  pills: Array<{
    id: string
    text: string
  }>
  title: string
}

export type StoryRankedItem = {
  imageSrc: StoryImageData
  rank: number
  title: string
}

export function StoryTopBar({
  eyebrow,
  logoUrl,
}: {
  eyebrow: string
  logoUrl: string
}) {
  return createElement(
    'div',
    {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
      },
    },

    createElement(
      'div',
      {
        style: {
          display: 'flex',
          fontSize: 17,
          fontWeight: 750,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.45)',
        },
      },
      eyebrow
    ),

    createElement(KinoLogo, {
      label: 'Kino',
      src: logoUrl,
      renderMode: 'og',
      style: {
        width: 120,
        height: 72,
      },
    })
  )
}

export function StoryHeader({
  eyebrow,
  title,
}: {
  eyebrow: string
  title: string
}) {
  return createElement(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        marginBottom: 34,
      },
    },

    createElement(
      'div',
      {
        style: {
          display: 'flex',
          marginBottom: 12,
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: '#32dc70',
        },
      },
      eyebrow
    ),

    createElement(
      'div',
      {
        style: {
          display: 'flex',
          maxWidth: 900,
          fontSize: 48,
          fontWeight: 850,
          lineHeight: 1.02,
          letterSpacing: '-0.04em',
          color: '#f7f8f7',
        },
      },
      title
    )
  )
}

export function StoryStatsOverview({
  tiles,
  watchTime,
  watchTimeLabel,
}: {
  tiles: Array<{
    label: string
    value: string
    subtitle?: string
  }>
  watchTime: string
  watchTimeLabel: string
}) {
  return createElement(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        marginBottom: 42,
      },
    },

    createElement(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          minHeight: 112,
          padding: '20px 28px',
          borderRadius: 22,
          border: '1px solid rgba(29,185,84,0.58)',
          background:
            'linear-gradient(100deg, rgba(29,185,84,0.14), rgba(29,185,84,0.06) 46%, rgba(29,185,84,0.03))',
          boxShadow: 'inset 0 0 0 1px rgba(29,185,84,0.05), 0 14px 34px rgba(0,0,0,0.10)',
        },
      },

      createElement(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'baseline',
            whiteSpace: 'nowrap',
            fontSize: 50,
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: '-0.04em',
            color: '#38e477',
          },
        },
        watchTime
      ),

      createElement(
        'div',
        {
          style: {
            display: 'flex',
            maxWidth: 180,
            marginLeft: 30,
            fontSize: 17,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.55)',
          },
        },
        watchTimeLabel
      )
    ),

    ...chunkTiles(tiles, 2).map((row, rowIndex) =>
      createElement(
        'div',
        {
          key: `summary-row-${rowIndex}`,
          style: {
            display: 'flex',
            gap: 12,
          },
        },

        ...row.map((tile) =>
          createElement(StorySummaryStatTile, {
            key: tile.label,
            label: tile.label,
            subtitle: tile.subtitle,
            value: tile.value,
          })
        )
      )
    )
  )
}

export function StorySummaryStatTile({
  kind = 'number',
  label,
  subtitle,
  value,
  valueSize,
}: {
  kind?: 'number' | 'text'
  label: string
  subtitle?: string
  value: string
  valueSize?: number
}) {
  const resolvedValueSize = valueSize ?? (kind === 'number' ? 34 : 23)

  return createElement(
    'div',
    {
      style: {
        display: 'flex',
        flex: 1,
        minWidth: 0,
        minHeight: 88,
        padding: '16px 22px',
        flexDirection: 'column',
        justifyContent: 'center',
        borderRadius: 18,
        border: '1px solid rgba(255,255,255,0.035)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.035))',
      },
    },

    createElement(
      'div',
      {
        style: {
          display: 'flex',
          fontSize: resolvedValueSize,
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: kind === 'number' ? '-0.035em' : '-0.025em',
          color: '#f5f7f5',
          whiteSpace: 'nowrap',
        },
      },
      value
    ),

    createElement(
      'div',
      {
        style: {
          display: 'flex',
          marginTop: 5,
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.46)',
        },
      },
      label
    ),

    subtitle
      ? createElement(
          'div',
          {
            style: {
              display: 'flex',
              marginTop: 4,
              fontSize: 12,
              fontWeight: 750,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.34)',
            },
          },
          subtitle
        )
      : null
  )
}

export function StoryFeaturedSection({ items }: { items: StoryFeaturedItem[] }) {
  return createElement(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        marginBottom: 34,
      },
    },

    createElement(
      'div',
      {
        style: {
          display: 'flex',
          gap: 16,
          padding: 16,
          borderRadius: 28,
          border: '1px solid rgba(29,185,84,0.46)',
          background: 'linear-gradient(180deg, rgba(29,185,84,0.07), rgba(255,255,255,0.018))',
          boxShadow: 'inset 0 0 0 1px rgba(29,185,84,0.04), 0 18px 50px rgba(0,0,0,0.16)',
        },
      },

      ...items.map((item, index) =>
        createElement(StoryFeaturedCard, {
          item,
          key: `${item.label}-${index}`,
        })
      )
    )
  )
}

function StoryFeaturedCard({ item }: { item: StoryFeaturedItem }) {
  return createElement(
    'div',
    {
      style: {
        display: 'flex',
        flex: 1,
        minWidth: 0,
        flexDirection: 'column',
        padding: 14,
        borderRadius: 22,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.025))',
      },
    },

    createElement(
      'div',
      {
        style: {
          display: 'flex',
          marginBottom: 12,
          fontSize: 14,
          fontWeight: 850,
          letterSpacing: '0.11em',
          textTransform: 'uppercase',
          color: '#35dc72',
        },
      },
      item.label
    ),

    createElement(
      'div',
      {
        style: {
          display: 'flex',
          width: '100%',
          height: 330,
          flexShrink: 0,
          overflow: 'hidden',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.06)',
          background: 'linear-gradient(150deg, rgba(43,26,75,0.94), rgba(13,24,41,0.94))',
        },
      },

      item.imageSrc
        ? createElement('img', {
            alt: item.title,
            src: item.imageSrc as string,
            width: 430,
            height: 330,
            style: {
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'flex',
            },
          })
        : createElement('div', {
            style: {
              display: 'flex',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(150deg, rgba(50,30,83,0.92), rgba(12,31,53,0.92))',
            },
          })
    ),

    createElement(
      'div',
      {
        style: {
          display: 'flex',
          minHeight: 92,
          paddingTop: 14,
          flexDirection: 'column',
        },
      },

      createElement(
        'div',
        {
          style: {
            display: 'flex',
            maxHeight: 60,
            overflow: 'hidden',
            fontSize: 24,
            fontWeight: 850,
            lineHeight: 1.08,
            letterSpacing: '-0.025em',
            color: '#f5f7f5',
          },
        },
        item.title
      ),

      item.meta
        ? createElement(
            'div',
            {
              style: {
                display: 'flex',
                marginTop: 8,
                minHeight: 20,
                overflow: 'hidden',
                fontSize: 16,
                lineHeight: 1.1,
                color: 'rgba(255,255,255,0.38)',
              },
            },
            item.meta
          )
        : null
    ),

    createElement(
      'div',
      {
        style: {
          display: 'flex',
          minHeight: 34,
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          marginTop: 'auto',
        },
      },

      ...item.pills.map((pill) =>
        createElement(
          'div',
          {
            key: pill.id,
            style: {
              display: 'flex',
              alignItems: 'center',
              minHeight: 30,
              padding: '5px 11px',
              borderRadius: 999,
              background: 'rgba(29,185,84,0.13)',
              border: '1px solid rgba(29,185,84,0.10)',
              color: '#32dc70',
              fontSize: 14,
              fontWeight: 750,
              whiteSpace: 'nowrap',
            },
          },
          pill.text
        )
      )
    )
  )
}

export function StoryRankedSections({
  sections,
}: {
  sections: Array<{
    items: StoryRankedItem[]
    title: string
  }>
}) {
  return createElement(
    'div',
    {
      style: {
        display: 'flex',
        gap: 18,
        marginBottom: 30,
      },
    },

    ...sections.map((section) =>
      createElement(StoryRankedList, {
        items: section.items,
        key: section.title,
        title: section.title,
      })
    )
  )
}

function StoryRankedList({ title, items }: { title: string; items: StoryRankedItem[] }) {
  return createElement(
    'div',
    {
      style: {
        display: 'flex',
        flex: 1,
        minWidth: 0,
        flexDirection: 'column',
      },
    },

    createElement(
      'div',
      {
        style: {
          display: 'flex',
          minHeight: 42,
          marginBottom: 8,
          fontSize: 16,
          fontWeight: 800,
          lineHeight: 1.28,
          letterSpacing: '0.11em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.44)',
        },
      },
      title
    ),

    ...items.map((item, index) =>
      createElement(StoryRankedRow, {
        item,
        key: `${item.title}-${item.rank}-${index}`,
      })
    )
  )
}

function StoryRankedRow({ item }: { item: StoryRankedItem }) {
  return createElement(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minHeight: 78,
        padding: '9px 12px',
        marginBottom: 10,
        borderRadius: 15,
        border: '1px solid rgba(255,255,255,0.035)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.032))',
      },
    },

    createElement(
      'div',
      {
        style: {
          display: 'flex',
          width: 28,
          height: 28,
          flexShrink: 0,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          background: 'rgba(29,185,84,0.14)',
          color: '#31d86d',
          fontSize: 15,
          fontWeight: 850,
        },
      },
      String(item.rank)
    ),

    item.imageSrc
      ? createElement('img', {
          alt: item.title,
          src: item.imageSrc as string,
          width: 48,
          height: 60,
          style: {
            display: 'flex',
            width: 48,
            height: 60,
            flexShrink: 0,
            borderRadius: 7,
            objectFit: 'cover',
            border: '1px solid rgba(255,255,255,0.08)',
          },
        })
      : createElement('div', {
          style: {
            display: 'flex',
            width: 48,
            height: 60,
            flexShrink: 0,
            borderRadius: 7,
            border: '1px solid rgba(255,255,255,0.07)',
            background: 'linear-gradient(150deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))',
          },
        }),

    createElement(
      'div',
      {
        style: {
          display: 'flex',
          flex: 1,
          minWidth: 0,
          alignItems: 'center',
          overflow: 'hidden',
        },
      },

      createElement(
        'div',
        {
          style: {
            display: 'flex',
            width: '100%',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            fontSize: 19,
            fontWeight: 800,
            lineHeight: 1.08,
            color: '#f4f7f5',
          },
        },
        item.title
      )
    )
  )
}

export function StoryStatTile({
  kind,
  label,
  value,
  valueSize,
}: {
  kind: 'number' | 'text'
  label: string
  value: string
  valueSize?: number
}) {
  const isNumber = kind === 'number'

  return createElement(
    'div',
    {
      style: {
        display: 'flex',
        flex: 1,
        minWidth: 0,
        minHeight: 94,
        padding: '16px 20px',
        flexDirection: 'column',
        justifyContent: 'center',
        borderRadius: 18,
        border: '1px solid rgba(255,255,255,0.035)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.032))',
      },
    },

    createElement(
      'div',
      {
        style: {
          display: 'flex',
          width: '100%',
          maxHeight: 54,
          overflow: 'hidden',
          fontSize: valueSize ?? (isNumber ? 34 : 23),
          lineHeight: 1.04,
          fontWeight: 880,
          letterSpacing: isNumber ? '-0.035em' : '-0.025em',
          color: '#f4f7f5',
        },
      },
      value
    ),

    createElement(
      'div',
      {
        style: {
          display: 'flex',
          marginTop: 6,
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.43)',
        },
      },
      label
    )
  )
}

export function StoryFooter({ text }: { text: string }) {
  return createElement(
    'div',
    {
      style: {
        display: 'flex',
        flexShrink: 0,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 20,
        color: 'rgba(255,255,255,0.30)',
        fontSize: 16,
        textAlign: 'center',
      },
    },
    text
  )
}

function chunkTiles<T>(items: T[], size: number) {
  const rows: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size))
  }

  return rows
}
