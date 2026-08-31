import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('banner picker constrains the desktop selection grid to the dialog width', async () => {
  const source = await readFile(
    new URL('../../../components/profile/banner-picker-dialog.tsx', import.meta.url),
    'utf8'
  )

  assert.match(
    source,
    /<div className="grid min-w-0 gap-4">/,
    'dialog content should be allowed to shrink within its popup'
  )
  assert.match(
    source,
    /<DialogContent className="min-w-0 w-\[calc\(100%-2rem\)\] max-w-3xl">/,
    'the dialog should keep responsive gutters while remaining capped on desktop'
  )
  assert.match(
    source,
    /<div className="grid min-w-0 gap-3 sm:grid-cols-2">/,
    'the banner selection grid should not grow beyond the dialog width'
  )
  assert.match(
    source,
    /className="group min-w-0 overflow-hidden rounded-md/,
    'banner tiles should be allowed to shrink below their image intrinsic width'
  )
  assert.equal(
    source.match(/overflow-x-hidden/g)?.length,
    2,
    'both banner result views should suppress horizontal overflow'
  )
  assert.equal(
    source.match(/wrap-break-word/g)?.length,
    2,
    'both banner empty states should wrap long translated text'
  )
})
