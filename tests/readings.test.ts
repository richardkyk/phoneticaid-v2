import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseLexicon } from '@/lib/hsk'
import {
  choicesByParagraph,
  parseChoices,
  parseReadingTable,
  planReadingChecks,
  readingsPrompt,
} from '@/lib/readings'
import { analyseText } from '@/lib/words'

const lexicon = parseLexicon(readFileSync('public/hsk/words.txt', 'utf8'))
const table = parseReadingTable(
  readFileSync('public/dict/readings.txt', 'utf8'),
)

describe('parseReadingTable', () => {
  it('reads the readings of each character', () => {
    expect(table.get('得')?.map((o) => o.pinyin)).toEqual(['dé', 'de', 'děi'])
    expect(table.get('还')?.[1]).toEqual({
      pinyin: 'huán',
      gloss: 'to pay back',
    })
  })

  it('leaves out characters with one reading, and 一 and 不', () => {
    expect(table.has('我')).toBe(false)
    expect(table.has('一')).toBe(false)
    expect(table.has('不')).toBe(false)
  })
})

describe('planReadingChecks', () => {
  const text = '他得走了。\n我们是学生。\n他得走了。\n你还好吗？'

  it('numbers the characters standing on their own with several readings', () => {
    const { nothingToAsk, requests } = planReadingChecks(
      text,
      lexicon,
      table,
      {},
    )
    expect(nothingToAsk).toEqual(['我们是学生。'])
    // the repeated paragraph is only asked about once
    expect(requests).toHaveLength(1)
    expect(requests[0].text).toBe('他得[1]走了[2]。\n你还[3]好[4]吗[5]？')
    expect(requests[0].questions.map((q) => q.char)).toEqual([
      '得',
      '了',
      '还',
      '好',
      '吗',
    ])
    expect(requests[0].places[2]).toEqual({
      paragraph: '你还好吗？',
      offset: 1,
    })
  })

  it('skips paragraphs that have been checked', () => {
    const { requests } = planReadingChecks(text, lexicon, table, {
      '他得走了。': {},
    })
    expect(requests[0].paragraphs).toEqual(['你还好吗？'])
  })

  it('splits long texts into several requests', () => {
    const long = Array.from({ length: 30 }, (_, i) => `他得走了${i}`).join('\n')
    const { requests } = planReadingChecks(long, lexicon, table, {})
    expect(requests.length).toBeGreaterThan(1)
    expect(requests.every((r) => r.questions.length <= 40)).toBe(true)
  })
})

describe('parseChoices', () => {
  const { requests } = planReadingChecks('他得走了。', lexicon, table, {})
  const [request] = requests

  it('reads the JSON in a reply', () => {
    expect(
      parseChoices('Sure! {"1": "děi", "2": "le"}', request.questions),
    ).toEqual({ 1: 'děi', 2: 'le' })
  })

  it('leaves out answers that are not options', () => {
    expect(
      parseChoices('{"1": "dei3", "2": "le", "3": "x"}', request.questions),
    ).toEqual({ 2: 'le' })
  })

  it('fails without JSON', () => {
    expect(() => parseChoices('I am not sure', request.questions)).toThrow()
  })

  it('lists the options in the prompt', () => {
    expect(readingsPrompt(request.text, request.questions)).toContain(
      '[1] 得: dé (to obtain); de (',
    )
  })

  it('puts the choices with their paragraphs', () => {
    expect(choicesByParagraph(request, { 1: 'děi' })).toEqual({
      '他得走了。': { 1: 'děi' },
    })
  })
})

describe('analyseText with chosen readings', () => {
  it('uses the chosen readings', () => {
    const { pinyin } = analyseText('他得走。\n他得走。', lexicon, {
      '他得走。': { 1: 'děi' },
    })
    expect(pinyin[1]).toBe('děi')
    expect(pinyin[6]).toBe('děi')
    expect(analyseText('他得走。', lexicon).pinyin[1]).toBe('de')
  })
})
