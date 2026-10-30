// Builds the word list in public/hsk from the complete-hsk-vocabulary dataset
// (MIT, https://github.com/drkameleon/complete-hsk-vocabulary).
//
// Each line is `word<TAB>pinyin<TAB>level`: the pinyin has one syllable per
// character, separated by spaces (儿 gets its own "r"), and the level is the
// word's HSK 3.0 level, empty for words only in HSK 2.0 (level 7 covers 7-9).
// Traditional forms are included so traditional text is matched too.
//
// Usage: node scripts/build-hsk.mjs

import { mkdir, writeFile } from 'node:fs/promises'

// pinned so the list only changes when this is bumped deliberately
const COMMIT = '7ac65bf1a6387d35f1ade478906172a19311c7f9'
const URL = `https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/${COMMIT}/complete.min.json`

const res = await fetch(URL)
if (!res.ok) throw new Error(`Failed to download ${URL}: ${res.status}`)
const entries = await res.json()

const syllables = (pinyin) =>
  pinyin.toLowerCase().replace(/u:/g, 'ü').trim().split(/\s+/)
// syllables without a tone mark (neutral tone)
const neutral = (syls) =>
  syls.filter((s) => !/[\u0300-\u036f]/.test(s.normalize('NFD'))).length

// word -> { pinyin, level }
const words = new Map()
const add = (word, syls, level) => {
  if (!word) return
  const existing = words.get(word)
  if (!existing) {
    words.set(word, { syls, level })
    return
  }
  existing.level = Math.min(existing.level, level)
  // an entry for another meaning may have a better reading
  if (!existing.syls && syls) existing.syls = syls
}

for (const entry of entries) {
  const levels = entry.l
    .filter((tag) => tag.startsWith('n'))
    .map((tag) => Number(tag.slice(1)))
  const level = levels.length ? Math.min(...levels) : Infinity

  // of several readings (e.g. 东西 dōngxī / dōngxi), prefer the everyday one,
  // which is usually the one with neutral tones. Pinyin that doesn't line up
  // with the characters is left out.
  const best = entry.f
    .map((form) => syllables(form.i.y))
    .filter((syls) => syls.length === entry.s.length)
    .sort((a, b) => neutral(b) - neutral(a))[0]
  add(entry.s, best, level)
  for (const form of entry.f) add(form.t, best, level)
}

const lines = [...words]
  .sort(([a], [b]) => (a < b ? -1 : 1))
  .map(([word, { syls, level }]) =>
    [word, syls?.join(' ') ?? '', level === Infinity ? '' : level].join('\t'),
  )

await mkdir('public/hsk', { recursive: true })
await writeFile('public/hsk/words.tsv', lines.join('\n') + '\n')
console.log(`public/hsk/words.tsv: ${words.size} words`)
