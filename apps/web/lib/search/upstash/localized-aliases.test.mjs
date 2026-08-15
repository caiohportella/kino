import assert from 'node:assert/strict'
import test from 'node:test'

import { mergeLocalizedTitleAliases } from './localized-aliases.ts'

test('merges supported KINO locales and maps regional locale aliases to the base language', () => {
  assert.deepEqual(
    mergeLocalizedTitleAliases({
      en: ['The Godfather'],
      pt: ['O Poderoso Chefão'],
      'pt-BR': ['O Poderoso Chefao'],
      fr: 'Le Parrain',
      it: 'Il Padrino',
      no: 'Gudfaren',
      es: 'El padrino',
      de: 'Der Pate',
      ja: 'Ignored locale',
    }),
    {
      en: 'The Godfather',
      pt: 'O Poderoso Chefão O Poderoso Chefao',
      fr: 'Le Parrain',
      it: 'Il Padrino',
      no: 'Gudfaren',
      es: 'El padrino',
      de: 'Der Pate',
    }
  )
})
