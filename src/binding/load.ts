import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export type VentiAddon = {
  engineVersion(): string
}

const require = createRequire(import.meta.url)

const candidatePaths = [
  ['zig-out', 'lib', 'venti.node'],
  ['dist', 'venti.node'],
]

function findPackageRoot(start: string): string | undefined {
  let current: string | undefined = start
  while (current !== undefined) {
    if (existsSync(join(current, 'package.json'))) return current
    const parent = dirname(current)
    current = parent === current ? undefined : parent
  }
  return undefined
}

function resolveAddonPath(): string {
  const root = findPackageRoot(dirname(fileURLToPath(import.meta.url)))
  if (root === undefined) {
    throw new Error('venti-ts: package root not found while resolving the native addon')
  }
  for (const parts of candidatePaths) {
    const candidate = join(root, ...parts)
    if (existsSync(candidate)) return candidate
  }
  throw new Error(`venti-ts: native addon not found under ${root}; run "pnpm build:binding"`)
}

let addon: VentiAddon | undefined

export function loadAddon(): VentiAddon {
  addon ??= require(resolveAddonPath()) as VentiAddon
  return addon
}
