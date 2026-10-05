// Copies /shared (pricing engine + seed data) into functions/shared so it deploys with the functions.
import { cpSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const from = join(here, '..', '..', 'shared')
const to = join(here, '..', 'shared')
mkdirSync(to, { recursive: true })
cpSync(from, to, { recursive: true })
console.log('shared → functions/shared')
