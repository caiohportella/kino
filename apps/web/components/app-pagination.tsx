import type { ComponentProps, ReactNode } from 'react'
import { MoreHorizontalIcon } from 'lucide-react'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { cn } from '@/lib/utils'

type PageToken = number | `ellipsis-${number}`

type AppPaginationProps = {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
  label?: string
  nextText?: string
  pageAriaLabel?: (page: number, currentPage: number) => string
  previousText?: string
  summary?: (currentPage: number, totalPages: number) => ReactNode
  ellipsisLabel?: string
}

export function AppPagination({
  page,
  totalPages,
  onPageChange,
  className,
  label = 'Pagination',
  ellipsisLabel = 'More pages',
  nextText = 'Next',
  pageAriaLabel = (nextPage, currentPage) =>
    nextPage === currentPage ? `Page ${nextPage}` : `Go to page ${nextPage}`,
  previousText = 'Previous',
  summary = (currentPage, total) => (
    <>
      Page {currentPage} of {total}
    </>
  ),
}: AppPaginationProps) {
  if (totalPages <= 1) return null

  const currentPage = clampPage(page, totalPages)
  const pageTokens = buildPageTokens(currentPage, totalPages)
  const previousPage = currentPage - 1
  const nextPage = currentPage + 1

  return (
    <div
      className={cn(
        'mt-4 flex flex-col items-center gap-3 rounded-md border border-white/10 bg-kino-surface p-3 sm:flex-row sm:justify-between',
        className
      )}
    >
      <p className="text-sm font-medium text-kino-muted">{summary(currentPage, totalPages)}</p>

      <Pagination aria-label={label} className="sm:mx-0 sm:w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              aria-disabled={currentPage === 1}
              aria-label={previousText}
              href={getPageHref(previousPage)}
              text={previousText}
              onClick={(event) => {
                event.preventDefault()
                if (currentPage > 1) onPageChange(previousPage)
              }}
              tabIndex={currentPage === 1 ? -1 : undefined}
            />
          </PaginationItem>

          {pageTokens.map((token) =>
            typeof token === 'number' ? (
              <PaginationItem key={token}>
                <PaginationLink
                  aria-label={pageAriaLabel(token, currentPage)}
                  href={getPageHref(token)}
                  isActive={token === currentPage}
                  onClick={(event) => {
                    event.preventDefault()
                    onPageChange(token)
                  }}
                >
                  {token}
                </PaginationLink>
              </PaginationItem>
            ) : (
              <PaginationItem key={token}>
                <PaginationEllipsis label={ellipsisLabel} />
              </PaginationItem>
            )
          )}

          <PaginationItem>
            <PaginationNext
              aria-disabled={currentPage === totalPages}
              aria-label={nextText}
              href={getPageHref(nextPage)}
              text={nextText}
              onClick={(event) => {
                event.preventDefault()
                if (currentPage < totalPages) onPageChange(nextPage)
              }}
              tabIndex={currentPage === totalPages ? -1 : undefined}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}

function PaginationEllipsis({
  className,
  label = 'More pages',
  ...props
}: ComponentProps<'span'> & { label?: string }) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn(
        "flex size-8 items-center justify-center [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <MoreHorizontalIcon />
      <span className="sr-only">{label}</span>
    </span>
  )
}

function buildPageTokens(currentPage: number, totalPages: number): PageToken[] {
  const visiblePages = new Set([1, totalPages])

  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    if (page > 1 && page < totalPages) visiblePages.add(page)
  }

  const sortedPages = Array.from(visiblePages).sort((left, right) => left - right)
  const tokens: PageToken[] = []

  for (const page of sortedPages) {
    const previous = tokens[tokens.length - 1]
    if (typeof previous === 'number') {
      const gap = page - previous
      if (gap === 2) {
        tokens.push(previous + 1)
      } else if (gap > 2) {
        tokens.push(`ellipsis-${previous}`)
      }
    }

    tokens.push(page)
  }

  return tokens
}

function clampPage(page: number, totalPages: number) {
  return Math.min(Math.max(1, page), totalPages)
}

function getPageHref(page: number) {
  return `#page-${Math.max(1, page)}`
}
