import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { lookUp, parseDictionary } from '@/lib/dictionary'

const dictionary = parseDictionary(
  [
    '还\thái\tstill|yet',
    '还\thuán\tto return',
    '還\t=还',
    '一\tyī\tone',
    '髮\tfà\thair',
  ].join('\n'),
)

// the real list
const full = parseDictionary(readFileSync('public/hsk/meanings.tsv', 'utf8'))

describe('parseDictionary', () => {
  it('reads each reading with its meanings', () => {
    expect(dictionary.get('还')).toEqual([
      { pinyin: 'hái', meanings: ['still', 'yet'] },
      { pinyin: 'huán', meanings: ['to return'] },
    ])
  })

  it('gives a traditional word the readings of its simplified one', () => {
    expect(dictionary.get('還')).toBe(dictionary.get('还'))
  })

  it('reads the full list', () => {
    expect(full.get('银行')?.[0].meanings).toContain('bank')
    expect(full.get('銀行')).toBe(full.get('银行'))
    // surnames are left out
    expect(full.get('还')?.map((r) => r.pinyin)).toEqual(['hái', 'huán'])
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
