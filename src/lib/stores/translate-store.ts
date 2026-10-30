import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { usePieceTableStore } from './piece-table-store'
import { useCursorStore } from './cursor-store'
import { useProjectsStore } from './projects-store'
import { getAvailableProviders, translate } from '../translate/functions'
import { providerIds } from '../translate/providers'
import type { ProviderChoice, ProviderId } from '../translate/providers'

export interface Translation {
  id: string
  original: string
  // where the text was in the document when it was translated (absolute
  // offsets, end is exclusive)
  start: number
  end: number
  translation: string
  // provider that produced the translation
  provider?: string
  error?: string
  createdAt: number
}

// translations kept per project
const MAX_HISTORY = 100

interface TranslateState {
  translate: boolean
  // translations still being worked out
  pending: Array<string>
  // per project, oldest first
  history: Record<string, Array<Translation>>
  // the translation shown beside the selection
  current: string | null
  provider: ProviderChoice
  availableProviders: Array<ProviderId> | null
  translateSelection: () => void
  toggleTranslate: () => void
  // shows a translation beside its text again, selecting it
  showTranslation: (id: string) => void
  dismiss: () => void
  clearHistory: () => void
  forgetProject: (projectId: string) => void
  setProvider: (provider: ProviderChoice) => void
  loadAvailableProviders: () => Promise<void>
}

const activeProjectId = () => useProjectsStore.getState().activeId

export const useTranslateStore = create<TranslateState>()(
  persist(
    (set, get) => {
      let currentAbortController: AbortController | null = null

      const projectHistory = (projectId = activeProjectId()) =>
        get().history[projectId] ?? []

      const setProjectHistory = (
        projectId: string,
        translations: Array<Translation>,
      ) =>
        set({
          history: {
            ...get().history,
            [projectId]: translations.slice(-MAX_HISTORY),
          },
        })

      const updateTranslation = (
        projectId: string,
        id: string,
        patch: Partial<Translation>,
      ) =>
        setProjectHistory(
          projectId,
          projectHistory(projectId).map((t) =>
            t.id === id ? { ...t, ...patch } : t,
          ),
        )

      return {
        translate: true,
        pending: [],
        history: {},
        current: null,
        provider: 'auto',
        availableProviders: null,
        translateSelection: async () => {
          if (!get().translate) return

          const range = useCursorStore.getState().getSelection()
          const original = usePieceTableStore.getState().extractSelection()
          if (!range || original.trim().length === 0) return
          const start = range.start.index
          const end = range.end.index

          // reselecting the last translated text doesn't translate it again
          const last = projectHistory().at(-1)
          if (
            last &&
            !last.error &&
            last.original === original &&
            last.start === start &&
            last.end === end
          ) {
            set({ current: last.id })
            return
          }

          // Cancel previous translation if it's running
          if (currentAbortController) {
            currentAbortController.abort()
          }

          const abortController = new AbortController()
          currentAbortController = abortController

          const projectId = activeProjectId()
          const id = crypto.randomUUID()
          setProjectHistory(projectId, [
            ...projectHistory(projectId),
            {
              id,
              original,
              start,
              end,
              translation: '',
              createdAt: Date.now(),
            },
          ])
          set({ current: id, pending: [...get().pending, id] })

          const update = (patch: Partial<Translation>) =>
            updateTranslation(projectId, id, patch)
          try {
            const res = await translate({
              data: { text: original, provider: get().provider },
              signal: abortController.signal,
            })
            if (res.ok) {
              update({ translation: res.translation, provider: res.provider })
            } else {
              update({ error: res.errors.join('\n') })
            }
          } catch (err: any) {
            if (err.name === 'AbortError') {
              // replaced by a newer selection, so not worth keeping
              setProjectHistory(
                projectId,
                projectHistory(projectId).filter((t) => t.id !== id),
              )
            } else {
              console.error(err)
              update({ error: 'Something went wrong' })
            }
          } finally {
            set({ pending: get().pending.filter((p) => p !== id) })
            if (currentAbortController === abortController) {
              currentAbortController = null
            }
          }
        },
        toggleTranslate: () => {
          const isCurrentlyOn = get().translate
          set((state) => ({ translate: !state.translate }))
          if (isCurrentlyOn) return
          get().translateSelection()
        },
        showTranslation: (id) => {
          const t = projectHistory().find((t) => t.id === id)
          if (!t) return
          useCursorStore.getState().selectRange(t.start, t.end)
          set({ current: id })
        },
        dismiss: () => set({ current: null }),
        clearHistory: () => {
          setProjectHistory(activeProjectId(), [])
          set({ current: null })
        },
        forgetProject: (projectId) => {
          const history = { ...get().history }
          delete history[projectId]
          set({ history })
        },
        setProvider: (provider) => set({ provider }),
        loadAvailableProviders: async () => {
          try {
            set({ availableProviders: await getAvailableProviders() })
          } catch (err) {
            console.error(err)
          }
        },
      }
    },
    {
      name: 'translate-settings',
      partialize: (state) => ({
        provider: state.provider,
        history: state.history,
      }),
      // a stored provider may have since been removed
      merge: (persisted, current) => {
        const stored = persisted as Partial<TranslateState> | undefined
        const provider = stored?.provider
        const valid =
          provider === 'auto' || providerIds.some((id) => id === provider)
        return {
          ...current,
          provider: valid ? provider! : 'auto',
          history: stored?.history ?? {},
        }
      },
    },
  ),
)
