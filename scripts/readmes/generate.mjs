import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderLocaleReadme } from './shared.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '../..')
const outputDir = resolve(projectRoot, 'docs/locales')
const batchId = process.argv[2]

if (!batchId) {
  console.error('Usage: node scripts/readmes/generate.mjs <batch-id>')
  process.exit(1)
}

const batch = await import(`./batch-${batchId}.mjs`)
await mkdir(outputDir, { recursive: true })

for (const locale of batch.default) {
  const target = resolve(outputDir, locale.file)
  await writeFile(target, renderLocaleReadme(locale), 'utf8')
  console.log(`wrote ${locale.file}`)
}
