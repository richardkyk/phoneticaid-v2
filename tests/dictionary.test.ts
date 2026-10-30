import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  lookUp,
  parseDictionary,
  readingOptions,
  shardOf,
} from '@/lib/dictionary'

const dictionary = parseDictionary(
  ['还\thái\tstill|yet', '还\thuán\tto return', '一\tyī\tone'].join('\n'),
)

// a word's part of the real dictionary
const shard = (word: string) =>
  parseDictionary(
    readFileSync(
      `public/dict/meanings/${String(shardOf(word)).padStart(2, '0')}.txt`,
      'utf8',
    ),
  )

describe('parseDictionary', () => {
  it('reads each reading with its meanings', () => {
    expect(dictionary.get('还')).toEqual([
      { pinyin: 'hái', meanings: ['still', 'yet'] },
      { pinyin: 'huán', meanings: ['to return'] },
    ])
  })

  it('finds words in their part of the real dictionary', () => {
    expect(shard('银行').get('银行')?.[0].meanings).toContain('bank')
    expect(shard('銀行').get('銀行')?.[0].meanings).toContain('bank')
    expect(shard('还书').get('还书')?.[0].pinyin).toBe('huán shū')
  })

  it('leaves out surnames, and tidies cross-references', () => {
    const readings = shard('还').get('还')!
    expect(new Set(readings.map((r) => r.pinyin))).toEqual(
      new Set(['hái', 'huán']),
    )
    expect(shard('银行').get('银行')?.[0].meanings).toContain(
      'measure word: 家, 个',
    )
  })

  it('keeps names when there is nothing else', () => {
    expect(shard('北京').get('北京')?.[0].pinyin).toBe('Běi jīng')
  })
})

describe('lookUp', () => {
  it('puts the reading the word has in the text first', () => {
    expect(lookUp(dictionary, '还', 'huán').map((r) => r.pinyin)).toEqual([
      'huán',
      'hái',
    ])
  })

  it('matches a reading whose tone was changed in the text', () => {
    expect(lookUp(dictionary, '一', 'yí')[0].pinyin).toBe('yī')
  })

  it('has nothing for an unlisted word', () => {
    expect(lookUp(dictionary, '馆', 'guǎn')).toEqual([])
  })
})

describe('readingOptions', () => {
  it("lists a word's readings, then the others its meanings mention", () => {
    const options = readingOptions(shard('泄露').get('泄露')!, 2)
    expect(options).toEqual([
      { syllables: ['xiè', 'lòu'] },
      { syllables: ['xiè', 'lù'], note: 'also said' },
    ])
  })

  it('lists each reading of a character once', () => {
    const options = readingOptions(shard('露').get('露')!, 1)
    expect(options.map((o) => o.syllables[0]).sort()).toEqual(['lòu', 'lù'])
  })

  it("leaves out pinyin that doesn't fit the word", () => {
    const options = readingOptions(
      [{ pinyin: 'yāo', meanings: ['also pr. yāo yāo for clarity'] }],
      1,
    )
    expect(options).toEqual([{ syllables: ['yāo'] }])
  })
})
