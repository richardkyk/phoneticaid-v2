import { describe, it, expect } from 'vitest'
import { analyseText, hiddenPinyin, rangePinyin } from '@/lib/words'
import { readFileSync } from 'node:fs'
import { extendLexicon, isKnownWord, parseLexicon } from '@/lib/hsk'

// word, pinyin, level
const lexicon = parseLexicon(
  [
    ['我', 'wǒ', 1],
    ['你', 'nǐ', 1],
    ['好', 'hǎo', 1],
    ['在', 'zài', 1],
    ['图', 'tú', 1],
    ['书', 'shū', 1],
    ['银行', 'yín háng', 1],
    ['工作', 'gōng zuò', 1],
    ['看', 'kàn', 1],
    ['图书馆', 'tú shū guǎn', 2],
    ['行', 'xíng', 2],
    ['喜欢', 'xǐ huan', 3],
    ['研究', 'yán jiū', 4],
    ['研究生', 'yán jiū shēng', 4],
    ['生命', 'shēng mìng', 4],
  ]
    .map((fields) => fields.join('\t'))
    .join('\n'),
)
const levels = lexicon.levels

// the real word list
const fullLexicon = parseLexicon(readFileSync('public/hsk/words.txt', 'utf8'))
// with CC-CEDICT's words
const extendedLexicon = extendLexicon(
  fullLexicon,
  readFileSync('public/dict/words.txt', 'utf8'),
)

const wordTexts = (text: string) => analyseText(text).words.map((w) => w.text)

describe('analyseText', () => {
  it('has pinyin for each character', () => {
    const text = '我在银行工作, ok!\n他行不行？'
    const { pinyin } = analyseText(text, fullLexicon)
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
    const { pinyin } = analyseText(text, fullLexicon)
    expect(pinyin).toHaveLength(text.length)
    expect(pinyin.at(-1)).toBe('hǎo')
  })

  it('has no pinyin until the word list has loaded', () => {
    expect(analyseText('你好').pinyin).toEqual(['', ''])
  })

  it('uses the usual reading of characters outside listed words', () => {
    const { pinyin } = analyseText('说个', fullLexicon)
    expect(pinyin).toEqual(['shuō', 'gè'])
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
    const analysis = analyseText('我喜欢银行。老师', fullLexicon)
    expect(rangePinyin(analysis, 0, 5)).toBe('wǒ xǐhuan yínháng')
    expect(rangePinyin(analysis, 3, 8)).toBe('yínháng lǎoshī')
  })
})

describe('analyseText with the word list', () => {
  const words = (text: string, lex = lexicon) =>
    analyseText(text, lex).words.map((w) => w.text)
  const sentencePinyin = (text: string) => {
    const analysis = analyseText(text, fullLexicon)
    return analysis.words
      .map((w) => analysis.pinyin.slice(w.start, w.end).join(''))
      .join(' ')
  }

  it('splits into listed words', () => {
    expect(words('我在图书馆看书')).toEqual(['我', '在', '图书馆', '看', '书'])
  })

  it('prefers words of even lengths', () => {
    expect(words('研究生命')).toEqual(['研究', '生命'])
  })

  it('uses the pinyin of the listed word', () => {
    const { pinyin } = analyseText('我喜欢', lexicon)
    expect(pinyin).toEqual(['wǒ', 'xǐ', 'huan'])
  })

  it('gets common words and particles right', () => {
    expect(sentencePinyin('他还没来，我们都是学生。')).toBe(
      'tā hái méi lái wǒmen dōu shì xuésheng',
    )
    expect(sentencePinyin('他慢慢地走着，跑得很快。')).toBe(
      'tā mànmàn de zǒu zhe pǎo de hěn kuài',
    )
    expect(sentencePinyin('孩子觉得很有意思，喜欢爸爸。')).toBe(
      'háizi juéde hěn yǒuyìsi xǐhuan bàba',
    )
    expect(sentencePinyin('银行在哪儿？')).toBe('yínháng zài nǎr')
  })

  it('handles traditional text', () => {
    expect(sentencePinyin('謝謝老師')).toBe('xièxie lǎoshī')
  })

  it('changes the tones of 一 and 不 as they are said', () => {
    expect(sentencePinyin('我不是，一个，一起，一定，不错')).toBe(
      'wǒ bú shì yí gè yìqǐ yídìng búcuò',
    )
    expect(sentencePinyin('不好，对不起，看一看')).toBe(
      'bù hǎo duìbuqǐ kàn yi kàn',
    )
    expect(sentencePinyin('一本书')).toBe('yì běn shū')
  })

  it('keeps the tone of 一 when counting or ordering', () => {
    expect(sentencePinyin('第一次，星期一下午，一月，十一个，统一了')).toBe(
      'dìyī cì xīngqī yī xiàwǔ yī yuè shí yī gè tǒngyī le',
    )
  })
})

describe('analyseText with CC-CEDICT words', () => {
  const sentencePinyin = (text: string) => {
    const analysis = analyseText(text, extendedLexicon)
    return analysis.words
      .map((w) => analysis.pinyin.slice(w.start, w.end).join(''))
      .join(' ')
  }

  it('finds words outside HSK, with their pinyin', () => {
    expect(sentencePinyin('我去图书馆还书')).toBe('wǒ qù túshūguǎn huánshū')
  })

  it('still splits HSK sentences the same way', () => {
    expect(sentencePinyin('他还没来，我们都是学生。')).toBe(
      'tā hái méi lái wǒmen dōu shì xuésheng',
    )
    expect(sentencePinyin('孩子觉得很有意思，喜欢爸爸。')).toBe(
      'háizi juéde hěn yǒuyìsi xǐhuan bàba',
    )
  })

  it('only uses them where HSK words would leave single characters', () => {
    const words = (text: string) =>
      analyseText(text, extendedLexicon).words.map((w) => w.text)
    expect(words('经济发展')).toEqual(['经济', '发展'])
    expect(words('下个星期')).toEqual(['下个', '星期'])
    expect(words('这个问题')).toEqual(['这个', '问题'])
  })
})
