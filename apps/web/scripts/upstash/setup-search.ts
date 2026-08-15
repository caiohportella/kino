import { createRedisSearchClient } from '../../lib/search/upstash/client.ts'
import { SEARCH_INDEX_NAME, setupRedisSearchIndexes } from '../../lib/search/upstash/indexes.ts'
import { parseCliArgs, readScriptUpstashConfig } from './shared.ts'

async function main() {
  parseCliArgs(process.argv.slice(2))
  const redis = createRedisSearchClient(readScriptUpstashConfig(process.env))
  await setupRedisSearchIndexes(redis)
  console.info(JSON.stringify({ setup: true, indexes: [SEARCH_INDEX_NAME] }))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
