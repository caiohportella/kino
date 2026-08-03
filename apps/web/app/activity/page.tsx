"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ActivityCard } from "@/components/activity-feed/ActivityCard";
import { ActivityFeedSkeleton } from "@/components/activity-feed/ActivityFeedSkeleton";
import { AppPagination } from "@/components/app-pagination";
import { EmptyState } from "@/components/kino";
import { PageHeader } from "@/components/page-header";
import { ProtectedContentGate } from "@/components/protected-content-gate";
import { ProtectedEmpty } from "@/components/protected-empty";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useActivityFeed } from "@/hooks/use-activity-feed";
import { useReviewLikeMutation } from "@/hooks/use-review-like-mutation";
import {
  localizedTitleKey,
  useLocalizedTitles,
} from "@/lib/use-localized-titles";
import { useLocale, useTranslation } from "@/lib/i18n";
import { getTmdb } from "@/lib/services";
import { useAuthStore } from "@/stores/auth-store";
import type { ActivityFeedCard, ActivityFeedFilter } from "@/lib/activity-feed";

function ActivityFeedItem({
  activity,
  locale,
  localizedTitle,
  onAuthRequired,
  viewerId,
}: {
  activity: ActivityFeedCard;
  locale: string;
  localizedTitle: {
    title: string;
    posterUrl: string | null;
    year: number | null;
  } | null;
  onAuthRequired: () => void;
  viewerId: string | null;
}) {
  const likeMutation = useReviewLikeMutation({ kind: "activity" });
  const canLikeReview = Boolean(
    viewerId && activity.review && activity.actor.id !== viewerId,
  );
  const pendingLike =
    activity.review !== null &&
    likeMutation.isPending &&
    likeMutation.variables?.reviewId === activity.review.id;

  return (
    <ActivityCard
      activity={activity}
      canLikeReview={canLikeReview}
      locale={locale}
      localizedTitle={localizedTitle}
      onAuthRequired={onAuthRequired}
      onLikeReview={() => {
        if (!activity.review) return;
        likeMutation.mutate({
          authorProfileId: activity.actor.id,
          liked: activity.review.likedByViewer,
          reviewId: activity.review.id,
        });
      }}
      pendingLike={pendingLike}
    />
  );
}

export default function ActivityPage() {
  const user = useAuthStore((state) => state.user);
  const resolution = useAuthStore(
    (state) => state.resolution ?? { status: "auth-loading" },
  );
  const { t } = useTranslation();
  const { locale, region } = useLocale();
  const [filter, setFilter] = useState<ActivityFeedFilter>("you");
  const [page, setPage] = useState(1);
  const itemsPerPage = 30;

  const viewerId = user?.id ?? null;
  const feed = useActivityFeed(
    viewerId,
    filter,
    locale,
    region,
    Boolean(viewerId),
  );
  const totalPages = Math.max(1, Math.ceil(feed.items.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginatedItems = feed.items.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const localizedTitleRequests = useMemo(
    () =>
      paginatedItems
        .filter((item) => item.subject.kind === "title")
        .map((item) => ({
          tmdbId: item.subject.kind === "title" ? item.subject.tmdbId : 0,
          type:
            item.subject.kind === "title" ? item.subject.mediaType : "movie",
        })),
    [paginatedItems],
  );
  const localizedTitles = useLocalizedTitles(localizedTitleRequests);

  const pageStatus = feed.isLoading
    ? "loading"
    : feed.isError
      ? "error"
      : feed.items.length === 0
        ? "empty"
        : "content";

  const feedSubtitleKey =
    filter === "you"
      ? "activity.feedSubtitleYou"
      : "activity.feedSubtitleFollowing";
  const emptyTitleKey =
    filter === "you"
      ? "activity.emptyYouTitle"
      : "activity.emptyFollowingTitle";
  const emptyBodyKey =
    filter === "you" ? "activity.emptyYouBody" : "activity.emptyFollowingBody";

  const filterOptions = useMemo(
    () => [
      { label: t("activity.filters.you"), value: "you" as const },
      { label: t("activity.filters.following"), value: "following" as const },
    ],
    [t],
  );

  useEffect(() => {
    setPage(1);
  }, [filter]);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages));
  }, [totalPages]);

  return (
    <ProtectedContentGate
      authLoadingFallback={
        <div className="content-frame">
          <ActivityFeedSkeleton count={5} label={t("activity.loading")} />
        </div>
      }
      emptyFallback={
        <div className="content-frame">
          <PageHeader
            title={t("activity.feedTitle")}
            body={t(feedSubtitleKey)}
          />
          <EmptyState
            action={
              <Link href="/search">
                <Button>{t("search.title")}</Button>
              </Link>
            }
            body={t(emptyBodyKey)}
            illustrationLabel={t("emptyStates.diaryIllustration")}
            title={t(emptyTitleKey)}
            variant="diary"
          />
        </div>
      }
      errorFallback={
        <div className="content-frame">
          <PageHeader title={t('activity.feedTitle')} body={t(feedSubtitleKey)} />
          <EmptyState body={feed.error?.message ?? t('common.tryAgain')} title={t('activity.error')} variant="diary" />
        </div>
      }
      pageLoadingFallback={
        <div className="content-frame">
          <ActivityFeedSkeleton count={5} label={t("activity.loading")} />
        </div>
      }
      pageStatus={pageStatus}
      resolution={resolution}
      unauthenticatedFallback={<ProtectedEmpty />}
    >
      <div className="content-frame">
        <PageHeader title={t("activity.feedTitle")} body={t(feedSubtitleKey)} />

        <div className="mb-5 flex items-center justify-between gap-3">
          <SegmentedControl
            onChange={setFilter}
            activeClassName="data-active:!border-kino-accent data-active:!bg-kino-accent data-active:!text-black"
            options={filterOptions}
            value={filter}
          />
        </div>

        {paginatedItems.length === 0 ? (
          <EmptyState
            action={
              <Link href="/search">
                <Button>{t("search.title")}</Button>
              </Link>
            }
            body={t(emptyBodyKey)}
            illustrationLabel={t("emptyStates.diaryIllustration")}
            title={t(emptyTitleKey)}
            variant="diary"
          />
        ) : (
          <div className="grid gap-3">
            {paginatedItems.map((activity) => {
              const localized =
                activity.subject.kind === "title"
                  ? localizedTitles.data[
                      localizedTitleKey({
                        tmdbId: activity.subject.tmdbId,
                        type: activity.subject.mediaType,
                      })
                    ]
                  : undefined;

              return (
                <ActivityFeedItem
                  activity={activity}
                  key={activity.id}
                  locale={locale}
                  localizedTitle={
                    localized
                      ? {
                          title: localized.title,
                          posterUrl: getTmdb().getImageUrl(localized.posterPath, "w300"),
                          year: localized.year,
                        }
                      : null
                  }
                  onAuthRequired={() => {
                    // ProtectedContentGate prevents unauthenticated rendering, but keep
                    // the callback for the shared like button contract.
                  }}
                  viewerId={viewerId}
                />
              );
            })}

            <AppPagination
              ellipsisLabel={t("activity.pagination.morePages")}
              label={t("activity.pagination.label")}
              nextText={t("activity.pagination.next")}
              onPageChange={setPage}
              page={currentPage}
              pageAriaLabel={(nextPage, currentPage) =>
                nextPage === currentPage
                  ? t("activity.pagination.currentPage", { page: nextPage })
                  : t("activity.pagination.goToPage", { page: nextPage })
              }
              previousText={t("activity.pagination.previous")}
              summary={(currentPage, total) =>
                t("activity.pagination.summary", {
                  currentPage,
                  totalPages: total,
                })
              }
              totalPages={totalPages}
            />
          </div>
        )}
      </div>
    </ProtectedContentGate>
  );
}
