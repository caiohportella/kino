import { createRedisSearchClient } from '../../lib/search/upstash/client.ts'
import { SEARCH_INDEX_NAME } from '../../lib/search/upstash/indexes.ts'
import { parseCliArgs, readScriptUpstashConfig } from './shared.ts'

async function main() {
  const args = parseCliArgs(process.argv.slice(2))
  if (process.env.ALLOW_UPSTASH_SEARCH_RESET !== 'true' && !args.has('force')) {
    throw new Error(
      'Refusing to reset Upstash search indexes. Set ALLOW_UPSTASH_SEARCH_RESET=true or pass --force.'
    )
  }

  const upstash = readScriptUpstashConfig(process.env)
  const client = createRedisSearchClient(upstash)
  await client.search.index({ name: SEARCH_INDEX_NAME }).drop()

  console.info(JSON.stringify({ reset: true, indexes: [SEARCH_INDEX_NAME] }))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
