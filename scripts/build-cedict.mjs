// Builds public/dict from CC-CEDICT (CC BY-SA 4.0, published by MDBG,
// https://www.mdbg.net/chinese/dictionary?page=cc-cedict):
//
// - words.txt: words that aren't in the HSK list (public/hsk/words.txt, so
//   build that first), as `word<TAB>pinyin` with one syllable per character.
//   They're used for splitting text into words and for their pinyin, after
//   the HSK list. Names, slang and words longer than four characters are
//   left out.
// - meanings/NN.txt: the English meanings of every word, for the dictionary
//   card, split by the first character's code point (mod SHARDS) so a card
//   only fetches a small file. One line per reading,
//   `word<TAB>pinyin<TAB>meanings`, the pinyin run together (dōngxi) and the
//   meanings separated by `|`.
//
// MDBG only publishes the latest version, so the output changes whenever
// this is run; the date is in public/dict/README.txt.
//
// The files are tab separated, but named .txt so Cloudflare compresses them
// (it doesn't for text/tab-separated-values).
//
// Usage: node scripts/build-cedict.mjs

import { gunzipSync } from 'node:zlib'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'

const URL =
  'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz'
// must match SHARDS in src/lib/dictionary.ts
const SHARDS = 64

const res = await fetch(URL)
if (!res.ok) throw new Error(`Failed to download ${URL}: ${res.status}`)
const text = gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8')
const date = /^#! date=(.*)$/m.exec(text)?.[1] ?? 'unknown'

const hsk = new Set(
  (await readFile('public/hsk/words.txt', 'utf8'))
    .split('\n')
    .map((line) => line.split('\t')[0]),
)

const isChinese = (word) => /^[一-鿿]+$/.test(word)

// ni3 -> nǐ, lu:4 -> lǜ, ma5 -> ma
function toneMark(syllable) {
  const match = /^([a-zA-Zü:]+)([1-5])$/.exec(syllable)
  if (!match) return syllable
  const letters = match[1].replace(/u:/g, 'ü').replace(/U:/g, 'Ü')
  const tone = Number(match[2])
  if (tone === 5) return letters
  const lower = letters.toLowerCase()
  // a or e takes the mark, then the o of ou, otherwise the last vowel
  let at = lower.search(/[ae]/)
  if (at === -1) at = lower.indexOf('ou')
  if (at === -1) {
    for (let i = lower.length - 1; i >= 0; i--) {
      if ('iouü'.includes(lower[i])) {
        at = i
        break
      }
    }
  }
  if (at === -1) return letters
  const mark = ['\u0304', '\u0301', '\u030c', '\u0300'][tone - 1]
  return (letters.slice(0, at + 1) + mark + letters.slice(at + 1)).normalize(
    'NFC',
  )
}

// 個|个[ge4] -> 个, 京[Jing1] -> 京, CL:家[jia1] -> measure word: 家,
// [ji2] -> jí
function tidyMeaning(meaning) {
  return (
    meaning
      .replace(/^CL:/, 'measure word: ')
      .replace(/(?:[^\s|,[\]]+\|)?([^\s|,[\]]+)\[[^\]]*\]/g, '$1')
      // Taiwan pr. [ji2] -> Taiwan pr. jí
      .replace(/\[((?:[a-zA-Z:]+[1-5] ?)+)\]/g, (_, py) =>
        py
          .match(/[a-zA-Z:]+[1-5]?/g)
          .map(toneMark)
          .join(''),
      )
      .replace(/,(?=\S)/g, ', ')
  )
}

const isVariant = (meaning) =>
  /^(old |archaic |unofficial |Japanese )?variant of /.test(meaning)

// word -> readings, in the order they're listed
const entries = new Map()
for (const line of text.split('\n')) {
  if (line.startsWith('#')) continue
  const match = /^(\S+) (\S+) \[([^\]]*)\] \/(.*)\/$/.exec(line.trim())
  if (!match) continue
  const [, traditional, simplified, pinyin, meanings] = match
  const syllables = pinyin.split(' ')
  const reading = {
    syllables: syllables.map(toneMark),
    name: /^[A-Z]/.test(pinyin),
    meanings: meanings.split('/').map(tidyMeaning),
  }
  for (const word of new Set([traditional, simplified])) {
    if (!isChinese(word)) continue
    if (!entries.has(word)) entries.set(word, [])
    entries.get(word).push(reading)
  }
}

// syllables without a tone mark (neutral tone)
const neutral = (syls) =>
  syls.filter((s) => !/[\u0300-\u036f]/.test(s.normalize('NFD'))).length

const wordLines = []
const shards = Array.from({ length: SHARDS }, () => [])
for (const [word, readings] of entries) {
  // names (Běijīng) and surnames (Huán) are only kept when there's nothing else
  const common = readings.filter((r) => !r.name)
  const kept = common.length ? common : readings

  // slang that's also an everyday phrase (我去 "OMG!", but usually "I go")
  // would split the phrase wrongly
  const everyday = common.filter(
    (r) => !/^\((Internet )?slang\)/.test(r.meanings[0]),
  )
  if (
    !hsk.has(word) &&
    everyday.length &&
    word.length > 1 &&
    word.length <= 4
  ) {
    // of several readings prefer the everyday one, usually the one with
    // neutral tones (东西 dōngxi). Pinyin that doesn't line up with the
    // characters is left out.
    const best = everyday
      .map((r) => r.syllables)
      .filter(
        (syls) =>
          syls.length === word.length && syls.every((s) => /^\p{L}+$/u.test(s)),
      )
      .sort((a, b) => neutral(b) - neutral(a))[0]
    if (best) wordLines.push(`${word}\t${best.join(' ')}`)
  }

  // readings with the same pinyin are merged
  const byPinyin = new Map()
  for (const reading of kept) {
    const pinyin = reading.syllables.join('')
    byPinyin.set(pinyin, [...(byPinyin.get(pinyin) ?? []), ...reading.meanings])
  }
  const shard = shards[word.codePointAt(0) % SHARDS]
  for (const [pinyin, list] of byPinyin) {
    // "variant of" says little next to a reading's real meanings
    const real = list.filter((m) => !isVariant(m))
    const meanings = [...new Set(real.length ? real : list)]
    shard.push([word, pinyin, meanings.join('|')].join('\t'))
  }
}

await rm('public/dict', { recursive: true, force: true })
await mkdir('public/dict/meanings', { recursive: true })
wordLines.sort()
await writeFile('public/dict/words.txt', wordLines.join('\n') + '\n')
await Promise.all(
  shards.map((lines, i) =>
    writeFile(
      `public/dict/meanings/${String(i).padStart(2, '0')}.txt`,
      lines.sort().join('\n') + '\n',
    ),
  ),
)
await writeFile(
  'public/dict/README.txt',
  `Built by scripts/build-cedict.mjs from CC-CEDICT (${date}).

CC-CEDICT is published by MDBG under the Creative Commons
Attribution-ShareAlike 4.0 International License
(https://creativecommons.org/licenses/by-sa/4.0/), and so are these files.
https://www.mdbg.net/chinese/dictionary?page=cc-cedict
`,
)
console.log(
  `public/dict: ${wordLines.length} extra words, meanings of ${entries.size} words (${date})`,
)
