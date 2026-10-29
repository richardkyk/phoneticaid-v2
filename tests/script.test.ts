import { describe, it, expect } from 'vitest'
import { Converter as cn2t } from 'opencc-js/cn2t'
import { Converter as t2cn } from 'opencc-js/t2cn'
import { convertText } from '@/lib/script'

const toTraditional = cn2t({ from: 'cn', to: 'tw' })
const toSimplified = t2cn({ from: 'tw', to: 'cn' })

describe('convertText', () => {
  it('converts by phrase', () => {
    expect(convertText('头发发展，干杯', toTraditional)).toBe('頭髮發展，乾杯')
    expect(convertText('謝謝老師\n我們明天見', toSimplified)).toBe(
      '谢谢老师\n我们明天见',
    )
  })

  it('leaves text already in the script alone', () => {
    expect(convertText('頭髮 hello', toTraditional)).toBe('頭髮 hello')
  })

  it('leaves a paragraph as typed if its length would change', () => {
    const grow = (text: string) => text.replace('好', '很好')
    expect(convertText('你好\n再见', grow)).toBe('你好\n再见')
    expect(convertText('好\n见', (t) => t.replace('见', '見'))).toBe('好\n見')
  })
})
