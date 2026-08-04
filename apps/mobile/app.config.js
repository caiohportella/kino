const { existsSync, readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const appJson = require('./app.json')

function readEnvFile(envPath) {
  if (!existsSync(envPath)) return {}

  return readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return env

      const separator = trimmed.indexOf('=')
      if (separator === -1) return env

      const key = trimmed.slice(0, separator).trim()
      const value = trimmed
        .slice(separator + 1)
        .trim()
        .replace(/^["']|["']$/g, '')
      if (key) env[key] = value
      return env
    }, {})
}

const workspaceRoot = resolve(__dirname, '..', '..')
const rootEnv = readEnvFile(resolve(workspaceRoot, '.env'))

function firstDefined(...names) {
  for (const name of names) {
    const value = process.env[name] ?? rootEnv[name]
    if (value) return value
  }
  return undefined
}

function setExpoPublicEnv(target, ...aliases) {
  const value = firstDefined(target, ...aliases)
  if (value) process.env[target] = value
}

setExpoPublicEnv('EXPO_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL')
setExpoPublicEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
setExpoPublicEnv('EXPO_PUBLIC_TMDB_API_KEY', 'NEXT_PUBLIC_TMDB_API_KEY')
setExpoPublicEnv('EXPO_PUBLIC_WEB_URL', 'NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_WEB_URL')
setExpoPublicEnv('EXPO_PUBLIC_AUTH_REDIRECT_URL', 'NEXT_PUBLIC_AUTH_REDIRECT_URL')
setExpoPublicEnv('EXPO_PUBLIC_APP_SCHEME', 'NEXT_PUBLIC_APP_SCHEME')
setExpoPublicEnv('EXPO_PUBLIC_KINO_API_URL')

module.exports = () => {
  const scheme = process.env.EXPO_PUBLIC_APP_SCHEME || appJson.expo.scheme || 'kino'
  if (!/^[a-z][a-z0-9+.-]*$/i.test(scheme)) {
    throw new Error('EXPO_PUBLIC_APP_SCHEME must be a URL scheme such as "kino".')
  }

  return {
    ...appJson.expo,
    scheme,
  }
}
