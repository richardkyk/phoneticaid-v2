import { create } from 'zustand'
import { toast } from 'sonner'
import { getText } from '../piece-table'
import { useLexiconStore } from '../hsk'
import {
  choicesByParagraph,
  parseReadingTable,
  planReadingChecks,
} from '../readings'
import type { ReadingTable } from '../readings'
import { analyseText } from '../words'
import type { ChosenReadings } from '../words'
import { chooseReadings } from '../translate/functions'
import { useProjectsStore } from './projects-store'
import { useTranslateStore } from './translate-store'

// Checking the readings of the active project's characters with AI (see
// readings.ts). The readings chosen are kept with the project.

interface ReadingsState {
  // requests done and to do while checking, otherwise null
  progress: { done: number; total: number } | null
  check: () => Promise<void>
  // the character whose pinyin was clicked, to pick its reading
  picking: number | null
  setPicking: (index: number | null) => void
}

let table: ReadingTable | undefined
async function loadTable() {
  if (table) return table
  const res = await fetch('/dict/readings.txt')
  if (!res.ok) throw new Error(`/dict/readings.txt: ${res.status}`)
  return (table = parseReadingTable(await res.text()))
}

// Adds readings to a project, dropping those of paragraphs it no longer has
function saveReadings(projectId: string, found: ChosenReadings) {
  const { projects } = useProjectsStore.getState()
  useProjectsStore.setState({
    projects: projects.map((project) => {
      if (project.id !== projectId) return project
      const paragraphs = new Set(getText(project.pt).split('\n'))
      const readings = Object.fromEntries(
        Object.entries({ ...project.readings, ...found }).filter(([p]) =>
          paragraphs.has(p),
        ),
      )
      return { ...project, readings }
    }),
  })
}

export const useReadingsStore = create<ReadingsState>()((set, get) => ({
  progress: null,
  picking: null,
  setPicking: (picking) => {
    if (get().picking !== picking) set({ picking })
  },
  check: async () => {
    if (get().progress) return
    const lexicon = useLexiconStore.getState().lexicon
    if (!lexicon) {
      toast.error('The word list is still loading')
      return
    }
    const project = useProjectsStore.getState().getActiveProject()
    set({ progress: { done: 0, total: 0 } })

    try {
      const { nothingToAsk, requests } = planReadingChecks(
        getText(project.pt),
        lexicon,
        await loadTable(),
        project.readings ?? {},
      )
      const found: ChosenReadings = Object.fromEntries(
        nothingToAsk.map((paragraph) => [paragraph, {}]),
      )
      saveReadings(project.id, found)
      if (requests.length === 0) {
        toast.success('The readings have all been checked')
        return
      }

      let asked = 0
      let changed = 0
      for (const [i, request] of requests.entries()) {
        set({ progress: { done: i, total: requests.length } })
        const res = await chooseReadings({
          data: {
            text: request.text,
            questions: request.questions,
            provider: useTranslateStore.getState().provider,
          },
        })
        if (!res.ok) {
          toast.error(`Couldn't check the readings: ${res.errors.join(', ')}`)
          return
        }
        const chosen = choicesByParagraph(request, res.choices)
        // shown as each request comes back
        saveReadings(project.id, chosen)
        asked += request.questions.length
        for (const [paragraph, readings] of Object.entries(chosen)) {
          const { pinyin } = analyseText(paragraph, lexicon)
          for (const [offset, syllable] of Object.entries(readings)) {
            if (pinyin[Number(offset)] !== syllable) changed++
          }
        }
      }
      toast.success(
        changed
          ? `Changed ${changed} of ${asked} readings`
          : `Checked ${asked} readings, which were all right`,
      )
    } catch (err) {
      console.error(err)
      toast.error("Couldn't check the readings")
    } finally {
      set({ progress: null })
    }
  },
}))

// The paragraph containing the character at `index`, and where it starts
function paragraphAt(text: string, index: number) {
  const start = text.lastIndexOf('\n', index - 1) + 1
  const end = text.indexOf('\n', index)
  return { paragraph: text.slice(start, end === -1 ? text.length : end), start }
}

// The reading picked for the character at `index` in the active project
export function pickedReading(index: number): string | undefined {
  const { pt, pickedReadings } = useProjectsStore.getState().getActiveProject()
  if (!pickedReadings) return
  const { paragraph, start } = paragraphAt(getText(pt), index)
  return pickedReadings[paragraph]?.[index - start]
}

// Picks the reading of the character at `index` in the active project, or
// goes back to the usual one with null. Kept by paragraph like the AI's, so
// it's lost if the paragraph is edited.
export function pickReading(index: number, syllable: string | null) {
  const { projects, activeId } = useProjectsStore.getState()
  useProjectsStore.setState({
    projects: projects.map((project) => {
      if (project.id !== activeId) return project
      const text = getText(project.pt)
      const { paragraph, start } = paragraphAt(text, index)
      const picked = { ...project.pickedReadings?.[paragraph] }
      if (syllable) picked[index - start] = syllable
      else delete picked[index - start]
      const paragraphs = new Set(text.split('\n'))
      const pickedReadings = Object.fromEntries(
        Object.entries({
          ...project.pickedReadings,
          [paragraph]: picked,
        }).filter(
          ([p, readings]) => paragraphs.has(p) && Object.keys(readings).length,
        ),
      )
      return { ...project, pickedReadings }
    }),
  })
}
