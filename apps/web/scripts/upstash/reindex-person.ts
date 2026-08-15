import { personDocumentFromTmdb } from '../../lib/search/upstash/person-document.ts'
import { createPersonIndexer } from '../../lib/search/upstash/person-indexer.ts'
import { createScriptTmdbService, parseCliArgs, readScriptUpstashConfig } from './shared.ts'

function personId(value: string | boolean | undefined): number {
  const parsed = Number(typeof value === 'string' ? value : '')
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new Error('Usage: pnpm upstash:reindex-person --tmdbId=<id>')
  return parsed
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2))
  const id = personId(args.get('tmdbId'))
  const person = await createScriptTmdbService(process.env).getPersonDetails(id)
  const document = personDocumentFromTmdb(person)
  if (!document) throw new Error(`TMDb person not found: ${id}`)
  await createPersonIndexer(readScriptUpstashConfig(process.env)).upsertDocument(document)
  console.info(JSON.stringify({ tmdbId: id, indexed: true }))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
