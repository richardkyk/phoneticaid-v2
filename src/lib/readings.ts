import type { Lexicon } from './hsk'
import { analyseText } from './words'
import type { ChosenReadings } from './words'

// Choosing, with AI, the readings of characters whose reading depends on
// what they mean in context (他得走 děi, 跑得快 de). Only characters standing
// on their own are asked about, as words have their own pinyin. The
// characters and their readings are in public/dict/readings.txt, built by
// scripts/build-cedict.mjs. Shared by the client and the server.

export interface ReadingOption {
  pinyin: string
  // a few words telling the readings apart
  gloss: string
}

// character -> its readings
export type ReadingTable = Map<string, Array<ReadingOption>>

export interface ReadingQuestion {
  // numbered from 1 in each request
  n: number
  char: string
  options: Array<ReadingOption>
}

// lines of `char<TAB>pinyin<TAB>gloss<TAB>pinyin<TAB>gloss…`
export function parseReadingTable(text: string): ReadingTable {
  const table: ReadingTable = new Map()
  for (const line of text.split('\n')) {
    const [char, ...fields] = line.split('\t')
    if (!char || fields.length < 4) continue
    const options: Array<ReadingOption> = []
    for (let i = 0; i + 1 < fields.length; i += 2) {
      options.push({ pinyin: fields[i], gloss: fields[i + 1] })
    }
    table.set(char, options)
  }
  return table
}

// Offsets of the characters in a paragraph that stand on their own and have
// more than one reading
export function ambiguousCharacters(
  paragraph: string,
  lexicon: Lexicon,
  table: ReadingTable,
): Array<number> {
  return analyseText(paragraph, lexicon)
    .words.filter((w) => w.end - w.start === 1 && table.has(w.text))
    .map((w) => w.start)
}

export const READINGS_SYSTEM_PROMPT = `
You choose how Chinese characters that have more than one reading are read in a text.
Each of these characters is followed by a number in brackets, e.g. 得[1].
For each number, choose the reading the character has in its context, from its options.
Reply with only a JSON object mapping each number to the pinyin you chose, e.g. {"1": "děi", "2": "de"}.
`

// The text with each asked about character numbered, and the options for each
export function readingsPrompt(
  markedText: string,
  questions: Array<ReadingQuestion>,
) {
  const options = questions.map(
    ({ n, char, options }) =>
      `[${n}] ${char}: ${options.map((o) => `${o.pinyin} (${o.gloss})`).join('; ')}`,
  )
  return `Text:\n${markedText}\n\nOptions:\n${options.join('\n')}`
}

// The readings chosen in a reply, leaving out any that aren't options
export function parseChoices(
  reply: string,
  questions: Array<ReadingQuestion>,
): Record<number, string> {
  const json = /\{[\s\S]*\}/.exec(reply)?.[0]
  if (!json) throw new Error('The reply had no JSON in it')
  const answers = JSON.parse(json) as Record<string, unknown>
  const choices: Record<number, string> = {}
  for (const { n, options } of questions) {
    const answer = answers[n]
    if (typeof answer !== 'string') continue
    const pinyin = answer.trim().normalize('NFC')
    if (options.some((o) => o.pinyin === pinyin)) choices[n] = pinyin
  }
  return choices
}

export interface ReadingRequest {
  // the paragraphs asked about, one per line, each asked about character
  // numbered (得[1])
  text: string
  questions: Array<ReadingQuestion>
  // where each question's answer goes, by n - 1
  places: Array<{ paragraph: string; offset: number }>
  paragraphs: Array<string>
}

// questions per request, so replies stay short and quick
const MAX_QUESTIONS = 40

// The paragraphs of the text that haven't been checked yet: those with
// nothing to ask about, and requests for the rest
export function planReadingChecks(
  text: string,
  lexicon: Lexicon,
  table: ReadingTable,
  chosen: ChosenReadings,
) {
  const nothingToAsk: Array<string> = []
  const requests: Array<ReadingRequest> = []
  let request: ReadingRequest | null = null

  for (const paragraph of new Set(text.split('\n'))) {
    if (paragraph in chosen) continue
    const offsets = ambiguousCharacters(paragraph, lexicon, table)
    if (offsets.length === 0) {
      nothingToAsk.push(paragraph)
      continue
    }
    if (!request || request.questions.length + offsets.length > MAX_QUESTIONS) {
      request = { text: '', questions: [], places: [], paragraphs: [] }
      requests.push(request)
    }
    let marked = ''
    let last = 0
    for (const offset of offsets) {
      const n = request.questions.length + 1
      const char = paragraph[offset]
      request.questions.push({ n, char, options: table.get(char)! })
      request.places.push({ paragraph, offset })
      marked += paragraph.slice(last, offset + 1) + `[${n}]`
      last = offset + 1
    }
    marked += paragraph.slice(last)
    request.text += (request.text ? '\n' : '') + marked
    request.paragraphs.push(paragraph)
  }
  return { nothingToAsk, requests }
}

// The readings chosen for a request's paragraphs
export function choicesByParagraph(
  request: ReadingRequest,
  choices: Record<number, string>,
): ChosenReadings {
  const chosen: ChosenReadings = {}
  for (const paragraph of request.paragraphs) chosen[paragraph] = {}
  request.places.forEach(({ paragraph, offset }, i) => {
    const pinyin = choices[i + 1]
    if (pinyin) chosen[paragraph][offset] = pinyin
  })
  return chosen
}
