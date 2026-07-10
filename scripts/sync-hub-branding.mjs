#!/usr/bin/env node
/**
 * Sync shared branding CSS into the static hub (Firebase Hosting has no package resolver).
 * Source of truth: packages/branding/src/
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const branding = join(root, 'packages/branding/src')
const hub = join(root, 'apps/hub')

copyFileSync(
  join(branding, 'platform-header.css'),
  join(hub, 'platform-header.css')
)

const hubCss = readFileSync(join(branding, 'hub.css'), 'utf8')
  // Static hub loads platform-header.css as a sibling stylesheet.
  .replace(/^@import\s+['"].*platform-header\.css['"]\s*;\s*\n?/m, '')

writeFileSync(join(hub, 'hub.css'), hubCss)
console.log('Synced hub CSS from @hae/branding')
