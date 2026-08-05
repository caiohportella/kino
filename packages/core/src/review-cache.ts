import type { ProfileReview, ProfileReviewsPage, Review, TitleReviewsPage } from './reviews.ts'

export function insertViewerReview(
  page: TitleReviewsPage | undefined,
  review: Review
): TitleReviewsPage {
  if (!page) return { items: [review], nextCursor: null, totalCount: 1 }
  const withoutExisting = page.items.filter((item) => item.id !== review.id && !item.isViewerReview)
  return {
    ...page,
    items: [review, ...withoutExisting],
    totalCount: page.totalCount + (page.items.some((item) => item.isViewerReview) ? 0 : 1),
  }
}

export function replaceReview(
  page: TitleReviewsPage | undefined,
  review: Review
): TitleReviewsPage | undefined {
  if (!page) return page
  return {
    ...page,
    items: page.items.map((item) => (item.id === review.id ? review : item)),
  }
}

export function updateReviewContent(
  page: TitleReviewsPage | undefined,
  reviewId: string,
  content: string
): TitleReviewsPage | undefined {
  if (!page) return page
  return {
    ...page,
    items: page.items.map((item) =>
      item.id === reviewId ? { ...item, content, updatedAt: new Date().toISOString() } : item
    ),
  }
}

export function removeReview(
  page: TitleReviewsPage | undefined,
  reviewId: string
): TitleReviewsPage | undefined {
  if (!page) return page
  const exists = page.items.some((item) => item.id === reviewId)
  return {
    ...page,
    items: page.items.filter((item) => item.id !== reviewId),
    totalCount: Math.max(0, page.totalCount - (exists ? 1 : 0)),
  }
}

export function updateReviewLike(
  page: TitleReviewsPage | undefined,
  reviewId: string,
  likedByViewer: boolean
): TitleReviewsPage | undefined {
  if (!page) return page
  return {
    ...page,
    items: page.items.map((item) => {
      if (item.id !== reviewId || item.likedByViewer === likedByViewer) return item
      return {
        ...item,
        likedByViewer,
        likeCount: Math.max(0, item.likeCount + (likedByViewer ? 1 : -1)),
      }
    }),
  }
}

export function replaceProfileReview(
  page: ProfileReviewsPage | undefined,
  review: ProfileReview
): ProfileReviewsPage | undefined {
  if (!page) return page
  return {
    ...page,
    items: page.items.map((item) => (item.id === review.id ? review : item)),
  }
}

export function removeProfileReview(
  page: ProfileReviewsPage | undefined,
  reviewId: string
): ProfileReviewsPage | undefined {
  if (!page) return page
  const exists = page.items.some((item) => item.id === reviewId)
  return {
    ...page,
    items: page.items.filter((item) => item.id !== reviewId),
    totalCount: Math.max(0, page.totalCount - (exists ? 1 : 0)),
  }
}

export function updateProfileReviewLike(
  page: ProfileReviewsPage | undefined,
  reviewId: string,
  likedByViewer: boolean
): ProfileReviewsPage | undefined {
  if (!page) return page
  return {
    ...page,
    items: page.items.map((item) => {
      if (item.id !== reviewId || item.likedByViewer === likedByViewer) return item
      return {
        ...item,
        likedByViewer,
        likeCount: Math.max(0, item.likeCount + (likedByViewer ? 1 : -1)),
      }
    }),
  }
}
