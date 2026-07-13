import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const buildRoot = join(process.cwd(), '.next')
const manifestPath = join(buildRoot, 'server', 'middleware-manifest.json')
const limitKb = Number(process.env.OG_BUNDLE_LIMIT_KB || 900)
const limitBytes = limitKb * 1024

if (!existsSync(manifestPath)) {
  throw new Error(`Missing ${manifestPath}. Run this check after next build.`)
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const functions = Object.entries(manifest.functions || {}).filter(([route]) =>
  route.includes('/api/og/') || route.includes('opengraph-image')
)

if (functions.length === 0) throw new Error('No Edge OG functions found in the build manifest.')

let failed = false
console.log(`OG Edge bundle report (limit: ${limitKb} KB)`)

for (const [route, entry] of functions.sort(([a], [b]) => a.localeCompare(b))) {
  const files = [...new Set(entry.files || [])]
  const measured = files.map((file) => {
    const path = join(buildRoot, file)
    return { file, bytes: existsSync(path) ? statSync(path).size : 0 }
  })
  const bytes = measured.reduce((total, file) => total + file.bytes, 0)
  const bundledFont = measured.find(({ file }) => /\.(?:ttf|otf|woff2?)$/i.test(file))
  const status = bytes > limitBytes || bundledFont ? 'FAIL' : 'PASS'

  console.log(`${status.padEnd(4)} ${(bytes / 1024).toFixed(1).padStart(7)} KB  ${route}`)
  if (bundledFont) console.error(`     bundled font asset: ${bundledFont.file}`)
  if (status === 'FAIL') failed = true
}

if (failed) {
  throw new Error(
    `One or more OG Edge functions exceed ${limitKb} KB or contain a bundled local font.`,
  )
}
