import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../components/profile-view.tsx', import.meta.url), 'utf8')

test('rating dialog open state is isolated from the full profile render', () => {
  assert.doesNotMatch(source, /const \[movieRatingOpen, setMovieRatingOpen\] = useState/)
  assert.doesNotMatch(source, /const \[seriesRatingOpen, setSeriesRatingOpen\] = useState/)
  assert.match(
    source,
    /function MovieRatingStat\([\s\S]*?const \[open, setOpen\] = useState\(false\)/
  )
  assert.match(
    source,
    /function SeriesRatingStat\([\s\S]*?const \[open, setOpen\] = useState\(false\)/
  )
})

test('rating dialogs retain stable localization requests during open and close animations', () => {
  assert.equal(source.match(/const localizedRequests = useMemo\(/g)?.length, 2)
  assert.equal(
    source.match(/const localizedTitles = useLocalizedTitles\(localizedRequests\)/g)?.length,
    2
  )
})
