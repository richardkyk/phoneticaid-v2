// Builds the HSK word lists in public/hsk from the complete-hsk-vocabulary
// dataset (MIT, https://github.com/drkameleon/complete-hsk-vocabulary).
//
// The output has one line per level (line 1 is level 1), holding that level's
// words separated by spaces. Traditional forms are included so traditional
// text is matched too. Level 7 covers levels 7-9.
//
// Usage: node scripts/build-hsk.mjs

import { mkdir, writeFile } from 'node:fs/promises'

// pinned so the lists only change when this is bumped deliberately
const COMMIT = '7ac65bf1a6387d35f1ade478906172a19311c7f9'
const URL = `https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/${COMMIT}/complete.min.json`

// level tag prefix used by the dataset for each version (HSK 2.0 is 'o')
const versions = { '3.0': 'n' }

const res = await fetch(URL)
if (!res.ok) throw new Error(`Failed to download ${URL}: ${res.status}`)
const entries = await res.json()

await mkdir('public/hsk', { recursive: true })

for (const [version, prefix] of Object.entries(versions)) {
  // word -> lowest level it appears in
  const levels = new Map()
  const add = (word, level) => {
    if (!word) return
    levels.set(word, Math.min(levels.get(word) ?? Infinity, level))
  }

  for (const entry of entries) {
    for (const tag of entry.l) {
      if (!tag.startsWith(prefix)) continue
      const level = Number(tag.slice(prefix.length))
      add(entry.s, level)
      for (const form of entry.f) add(form.t, level)
    }
  }

  const byLevel = []
  for (const [word, level] of levels) (byLevel[level - 1] ??= []).push(word)
  const lines = Array.from(byLevel, (words) => (words ?? []).sort().join(' '))

  const file = `public/hsk/hsk-${version}.txt`
  await writeFile(file, lines.join('\n') + '\n')
  console.log(
    `${file}: ${levels.size} words`,
    lines.map((l) => (l ? l.split(' ').length : 0)),
  )
}
