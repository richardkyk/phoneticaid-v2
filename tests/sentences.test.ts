import { describe, it, expect } from 'vitest'
import { sentenceAt } from '@/lib/sentences'

const sentence = (text: string, index: number) => {
  const [start, end] = sentenceAt(text, index)
  return text.slice(start, end)
}

describe('sentenceAt', () => {
  const text = '我是学生。你呢？他说：“我也是！”\n新的段落'

  it('finds the sentence around a character, with its end', () => {
    expect(sentence(text, 0)).toBe('我是学生。')
    expect(sentence(text, 2)).toBe('我是学生。')
    expect(sentence(text, 4)).toBe('我是学生。')
    expect(sentence(text, 6)).toBe('你呢？')
  })

  it('keeps closing quotes with their sentence', () => {
    expect(sentence(text, 10)).toBe('他说：“我也是！”')
  })

  it('stops at the end of the paragraph', () => {
    expect(sentence(text, text.length - 1)).toBe('新的段落')
  })

  it('keeps repeated marks and leaves out spaces', () => {
    expect(sentence('  真的吗？？ 好', 3)).toBe('真的吗？？')
    expect(sentence('  真的吗？？ 好', 8)).toBe('好')
  })
})
