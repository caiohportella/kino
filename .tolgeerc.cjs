const { loadEnvFile } = require('node:process')

try {
  loadEnvFile('.env.local')
} catch {
  // .env.local is optional
}

module.exports = {
  $schema: 'https://docs.tolgee.io/cli-schema.json',

  apiUrl: process.env.TOLGEE_API_URL ?? 'http://localhost:8989',
  projectId: process.env.TOLGEE_PROJECT_ID,

  format: 'JSON_I18NEXT',
  strictNamespace: false,

  extractor: './scripts/tolgee-extractor.mjs',

  patterns: ['./apps/web/**/*.ts?(x)', './packages/**/*.ts?(x)'],

  pull: {
    path: './packages/i18n/generated',
    emptyDir: true,
  },

  sync: {
    removeUnused: false,
  },
}
