'use client'

import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseConfig } from './config'

const { url, anonKey } = getSupabaseConfig()

export const supabase = createBrowserClient(url, anonKey)
