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
// It's named .txt rather than .tsv so Cloudflare compresses it.
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

// readings the dataset gets wrong, by simplified form
const WORD_PINYIN = {
  泄露: 'xiè lòu',
}

// other ways a traditional character is written, for words the dataset only
// lists with the first
const VARIANTS = {
  泄: '洩',
}

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
  const syls = WORD_PINYIN[entry.s]?.split(' ') ?? best
  add(entry.s, syls, level)
  for (const form of entry.f) {
    add(form.t, syls, level)
    // 泄露 is written 洩露 too, which the dataset leaves out
    const variant = [...form.t].map((c) => VARIANTS[c] ?? c).join('')
    if (variant !== form.t) add(variant, syls, level)
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
  佛: 'fó',
  嚼: 'jiáo',
  妳: 'nǐ',
  漂: 'piāo',
  摻: 'chān',
  挣: 'zhèng',
  掙: 'zhèng',
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
await writeFile('public/hsk/words.txt', lines.join('\n') + '\n')
console.log(`public/hsk/words.txt: ${words.size} words`)
