// Builds the word list in public/hsk from the complete-hsk-vocabulary dataset
// (MIT, https://github.com/drkameleon/complete-hsk-vocabulary), plus the
// usual reading of every other character from Unihan's kMandarin field
// (Unicode license, https://www.unicode.org/charts/unihan.html).
//
// Each line is `word<TAB>pinyin<TAB>level`: the pinyin has one syllable per
// character, separated by spaces (儿 gets its own "r"), and the level is the
// word's HSK 3.0 level, empty for words only in HSK 2.0 (level 7 covers 7-9)
// and for characters that aren't HSK words. Traditional forms are included
// so traditional text is matched too.
//
// Alongside it, meanings.tsv has the English meanings of each word, for the
// dictionary card: one line per reading, `word<TAB>pinyin<TAB>meanings`, the
// pinyin run together (dōngxi) and the meanings separated by `|`. A
// traditional word with the same readings as its simplified one has a single
// `word<TAB>=simplified` line instead.
//
// Usage: node scripts/build-hsk.mjs (needs `unzip`)

import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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

function isName(form) {
  return /^[A-ZÀ-Ü]/.test(form.i.y)
}

// word -> pinyin -> meanings
const meanings = new Map()
// traditional word -> simplified
const simplified = new Map()
function addMeanings(word, pinyin, list) {
  if (!meanings.has(word)) meanings.set(word, new Map())
  const readings = meanings.get(word)
  const existing = readings.get(pinyin) ?? []
  // a traditional form's "variant of 个" says nothing about 个 itself
  const own = list.filter((meaning) => !meaning.includes(`variant of ${word}`))
  if (!own.length) return
  readings.set(pinyin, [...new Set([...existing, ...own])])
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

  // surnames (Huán) are left out, unless the word has no other reading
  const forms = entry.f.some((form) => !isName(form))
    ? entry.f.filter((form) => !isName(form))
    : entry.f
  for (const form of forms) {
    if (!form.m?.length) continue
    const pinyin = form.i.y.replace(/u:/g, 'ü').replace(/\s+/g, '')
    // the simplified word has every form's readings, a traditional one only
    // its own (发 fā and fà, but 發 fā and 髮 fà)
    for (const word of new Set([entry.s, form.t])) {
      addMeanings(word, pinyin, form.m)
    }
    if (form.t !== entry.s) simplified.set(form.t, entry.s)
  }
}

// The reading of a character on its own. The dataset's are no good for this
// (it picks one entry per character, e.g. 说 shuì, 个 gě), so Unihan's most
// customary reading is used, unless it's listed here.
const SINGLE_CHARACTER_PINYIN = {
  得: 'de',
  长: 'cháng',
  長: 'cháng',
  着: 'zhe',
  著: 'zhe',
  乾: 'gān',
}

const UNIHAN = 'https://www.unicode.org/Public/16.0.0/ucd/Unihan.zip'
const unihanRes = await fetch(UNIHAN)
if (!unihanRes.ok)
  throw new Error(`Failed to download ${UNIHAN}: ${unihanRes.status}`)
const dir = await mkdtemp(join(tmpdir(), 'unihan-'))
try {
  const zip = join(dir, 'Unihan.zip')
  await writeFile(zip, Buffer.from(await unihanRes.arrayBuffer()))
  execFileSync('unzip', ['-q', zip, 'Unihan_Readings.txt', '-d', dir])
  const readings = await readFile(join(dir, 'Unihan_Readings.txt'), 'utf8')
  for (const line of readings.split('\n')) {
    const [code, field, value] = line.split('\t')
    if (!code.startsWith('U+') || field !== 'kMandarin') continue
    const char = String.fromCodePoint(parseInt(code.slice(2), 16))
    // only the characters the app treats as Chinese
    if (!/^[一-鿿]$/.test(char)) continue
    const syls = [SINGLE_CHARACTER_PINYIN[char] ?? value.split(' ')[0]]
    const existing = words.get(char)
    if (existing) existing.syls = syls
    else words.set(char, { syls, level: Infinity })
  }
} finally {
  await rm(dir, { recursive: true })
}

const lines = [...words]
  .sort(([a], [b]) => (a < b ? -1 : 1))
  .map(([word, { syls, level }]) =>
    [word, syls?.join(' ') ?? '', level === Infinity ? '' : level].join('\t'),
  )

await mkdir('public/hsk', { recursive: true })
await writeFile('public/hsk/words.tsv', lines.join('\n') + '\n')
console.log(`public/hsk/words.tsv: ${words.size} words`)

const readingLines = (word) =>
  [...meanings.get(word)].map(([pinyin, list]) =>
    [word, pinyin, list.join('|')].join('\t'),
  )
const meaningLines = [...meanings.keys()]
  .sort((a, b) => (a < b ? -1 : 1))
  .flatMap((word) => {
    const lines = readingLines(word)
    const alias = simplified.get(word)
    // the same readings as the simplified word
    const same =
      alias &&
      meanings.has(alias) &&
      lines.join('\n') ===
        readingLines(alias).join('\n').replaceAll(`${alias}\t`, `${word}\t`)
    return same ? [`${word}\t=${alias}`] : lines
  })
await writeFile('public/hsk/meanings.tsv', meaningLines.join('\n') + '\n')
console.log(`public/hsk/meanings.tsv: ${meanings.size} words`)
