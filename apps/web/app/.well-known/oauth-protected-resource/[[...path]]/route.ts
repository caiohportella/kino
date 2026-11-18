import { metadata } from '@/lib/ai/oauth'
export async function GET(_request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path } = await context.params
  return !path || (path.length === 1 && path[0] === 'mcp')
    ? metadata('resource')
    : new Response(null, { status: 404 })
}
