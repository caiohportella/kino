export function getRequiredEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name}. Add it to the root .env file.`)
  }
  return value
}

export function getOptionalEnv(name: string) {
  return process.env[name] || null
}
