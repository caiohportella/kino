import { ActivityFeedSkeleton } from '@/components/activity-feed/ActivityFeedSkeleton'

export default function Loading() {
  return (
    <div className="content-frame">
      <ActivityFeedSkeleton count={5} label="Loading activity" />
    </div>
  )
}
