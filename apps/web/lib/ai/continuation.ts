const FLOW = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/
export const AI_LOGIN_COOKIE = 'kino_ai_login'

export function consentPath(flow: unknown) {
  return typeof flow === 'string' && FLOW.test(flow) ? `/auth/authorize?flow=${flow}` : null
}

export function flowCookie(flow: string) {
  return `kino_ai_flow_${flow}`
}

export function hasConsentProof(flow: string, proof?: string): proof is string {
  return Boolean(consentPath(flow) && proof && /^[A-Za-z0-9_-]{43}$/.test(proof))
}

export function consentLoginPath(flow: string) {
  return `/auth/login?ai_flow=${flow}`
}
