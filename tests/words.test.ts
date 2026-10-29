import { describe, it, expect } from 'vitest'
import { analyseText, hiddenPinyin, rangePinyin } from '@/lib/words'
import { isKnownWord, parseHskLevels } from '@/lib/hsk'

const levels = parseHskLevels(
  ['我 你 好 在 图 书 银行 工作 看', '图书馆 行', '喜欢'].join('\n'),
)

const wordTexts = (text: string) => analyseText(text).words.map((w) => w.text)

describe('analyseText', () => {
  it('has pinyin for each character', () => {
    const text = '我在银行工作, ok!\n他行不行？'
    const { pinyin } = analyseText(text)
    expect(pinyin).toHaveLength(text.length)
    expect(pinyin.slice(0, 6)).toEqual([
      'wǒ',
      'zài',
      'yín',
      'háng',
      'gōng',
      'zuò',
    ])
    // non-Chinese characters and the newline have none
    expect(pinyin.slice(6, 12).every((p) => p === '')).toBe(true)
    expect(pinyin[13]).toBe('xíng')
  })

  it('keeps the pinyin aligned after the two unit placeholder', () => {
    const text = '師\u{E0000}好'
    const { pinyin } = analyseText(text)
    expect(pinyin).toHaveLength(text.length)
    expect(pinyin.at(-1)).toBe('hǎo')
  })

  it('only keeps words with Chinese characters', () => {
    const words = wordTexts('我在银行工作, ok!')
    expect(words).toContain('银行')
    expect(words.join('')).toBe('我在银行工作')
  })

  it('maps characters to words with absolute offsets across paragraphs', () => {
    const text = '你好\n银行'
    const { words, wordAt } = analyseText(text)
    const bank = words.findIndex((w) => w.text === '银行')
    expect(words[bank]).toMatchObject({ start: 3, end: 5 })
    expect(Array.from(wordAt.slice(3, 5))).toEqual([bank, bank])
    expect(wordAt[2]).toBe(-1)
  })

  it('handles traditional text', () => {
    expect(wordTexts('謝謝老師')).toContain('謝謝')
  })
})

describe('isKnownWord', () => {
  it('uses the level of a listed word', () => {
    expect(isKnownWord('银行', levels, 1)).toBe(true)
    expect(isKnownWord('图书馆', levels, 1)).toBe(false)
    expect(isKnownWord('图书馆', levels, 2)).toBe(true)
  })

  it('falls back to the characters of an unlisted word', () => {
    expect(isKnownWord('看我', levels, 1)).toBe(true)
    // 馆 isn't listed
    expect(isKnownWord('书馆', levels, 3)).toBe(false)
  })

  it('treats an unlisted character as unknown', () => {
    expect(isKnownWord('馆', levels, 3)).toBe(false)
  })
})

describe('hiddenPinyin', () => {
  const text = '我喜欢银行'
  const analysis = analyseText(text)

  it('hides nothing or everything', () => {
    expect(hiddenPinyin(analysis, 'all', levels, 1)).toBeNull()
    expect(Array.from(hiddenPinyin(analysis, 'none', levels, 1)!)).toEqual([
      1, 1, 1, 1, 1,
    ])
  })

  it('shows everything until the word list has loaded', () => {
    expect(hiddenPinyin(analysis, 'unknown', undefined, 1)).toBeNull()
  })

  it('hides the pinyin of known words', () => {
    const hidden = hiddenPinyin(analysis, 'unknown', levels, 1)!
    const shown = Array.from(text).filter((_, i) => !hidden[i])
    expect(shown.join('')).toBe('喜欢')
    expect(Array.from(hiddenPinyin(analysis, 'unknown', levels, 3)!)).toEqual([
      1, 1, 1, 1, 1,
    ])
  })
})

describe('rangePinyin', () => {
  it('runs the syllables of a word together', () => {
    const analysis = analyseText('我喜欢银行。你好')
    expect(rangePinyin(analysis, 0, 5)).toBe('wǒ xǐhuān yínháng')
    expect(rangePinyin(analysis, 3, 8)).toBe('yínháng nǐhǎo')
  })
})
