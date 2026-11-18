import { metadata } from '@/lib/ai/oauth'
export const dynamic = 'force-dynamic'
export function GET() {
  return metadata('issuer')
}
