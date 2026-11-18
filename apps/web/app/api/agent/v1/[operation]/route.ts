import { handleAgentRequest } from '@/lib/agent/operations'

export const runtime = 'nodejs'

export async function POST(request: Request, context: { params: Promise<{ operation: string }> }) {
  return handleAgentRequest(request, (await context.params).operation)
}
