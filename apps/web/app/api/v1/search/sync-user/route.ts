import { type NextRequest, NextResponse } from 'next/server'
import { deleteUserSearchProfile, upsertUserSearchProfile } from '@/lib/search/upstash/user-sync'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type SyncAction = 'upsert' | 'delete'

function parseAction(value: unknown): SyncAction {
  return value === 'delete' ? 'delete' : 'upsert'
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as { action?: unknown }
  const action = parseAction(body.action)

  try {
    if (action === 'delete') {
      await deleteUserSearchProfile(user.id)
    } else {
      await upsertUserSearchProfile(supabase, user.id)
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'sync_failed' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
