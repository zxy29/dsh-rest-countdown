#!/usr/bin/env node
/**
 * Fill the GitHub-owner placeholder in package.json and README.md.
 *
 *   node scripts/set-owner.mjs <github-user>
 *
 * Writes UTF-8 directly so the Chinese README survives on Windows PowerShell,
 * where `Get-Content | Set-Content` can re-encode the file.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PLACEHOLDER = 'YOUR_GITHUB_USER'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const owner = (process.argv[2] || '').trim()

if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner)) {
  console.error('Usage: node scripts/set-owner.mjs <github-user>')
  console.error('  <github-user> is your GitHub user or organization name, e.g. zhangsan')
  process.exit(1)
}

let touched = 0
for (const file of ['package.json', 'README.md']) {
  const path = join(root, file)
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    console.log(file + ': not found, skipped')
    continue
  }
  const count = text.split(PLACEHOLDER).length - 1
  if (count === 0) {
    console.log(file + ': no ' + PLACEHOLDER + ' placeholder, skipped')
    continue
  }
  writeFileSync(path, text.split(PLACEHOLDER).join(owner), 'utf8')
  touched += count
  console.log(file + ': replaced ' + count + ' placeholder(s) with "' + owner + '"')
}

console.log('')
if (touched === 0) console.log('Nothing to do — the placeholder is already gone.')
else console.log('Done. Review package.json repository/homepage/bugs, then run: npm run check')
