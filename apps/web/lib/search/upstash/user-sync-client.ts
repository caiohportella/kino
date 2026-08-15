'use client'

type UserSearchSyncAction = 'upsert' | 'delete'

export async function syncCurrentUserSearchProfile(action: UserSearchSyncAction = 'upsert') {
  const response = await fetch('/api/v1/search/sync-user', {
    body: JSON.stringify({ action }),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error('Failed to sync user search profile')
  }
}
