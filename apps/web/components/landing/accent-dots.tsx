import { Fragment } from 'react'

export function AccentDots({ children }: { children: string }) {
  const parts = children.split('.')

  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={`${part}-${index}`}>
          {part}
          {index < parts.length - 1 ? <span className="text-kino-accent">.</span> : null}
        </Fragment>
      ))}
    </>
  )
}
