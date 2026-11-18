import { authorize, oauthPost } from '@/lib/ai/oauth'
export const runtime = 'nodejs'
type Context = { params: Promise<{ action: string }> }
export async function GET(request: Request, context: Context) {
  return (await context.params).action === 'authorize'
    ? authorize(request)
    : new Response(null, { status: 405 })
}
export async function POST(request: Request, context: Context) {
  return oauthPost(request, (await context.params).action)
}
