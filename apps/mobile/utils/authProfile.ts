export type MobileAuthProfileStatus = 'idle' | 'loading' | 'ready' | 'error'

type ProfileUser = { id: string }

export function createAuthProfileResolver(
  readProfile: (userId: string) => Promise<unknown>,
  onStatus: (status: MobileAuthProfileStatus) => void
) {
  let requestVersion = 0

  return {
    async resolve(user: ProfileUser | null) {
      const version = ++requestVersion
      if (!user) {
        onStatus('idle')
        return
      }

      onStatus('loading')
      try {
        await readProfile(user.id)
        if (version === requestVersion) onStatus('ready')
      } catch (error) {
        if (version !== requestVersion) return
        onStatus('error')
        throw error
      }
    },
  }
}
