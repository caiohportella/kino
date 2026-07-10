import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
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
}

export function AppPagination({
  page,
  totalPages,
  onPageChange,
  className,
  label = 'Pagination',
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
      <p className="text-sm font-medium text-kino-muted">
        Page {currentPage} of {totalPages}
      </p>

      <Pagination aria-label={label} className="sm:mx-0 sm:w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              aria-disabled={currentPage === 1}
              href={getPageHref(previousPage)}
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
                  aria-label={token === currentPage ? `Page ${token}` : `Go to page ${token}`}
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
                <PaginationEllipsis />
              </PaginationItem>
            )
          )}

          <PaginationItem>
            <PaginationNext
              aria-disabled={currentPage === totalPages}
              href={getPageHref(nextPage)}
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
