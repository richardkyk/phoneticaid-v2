import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { usePieceTableStore } from './piece-table-store'
import { getAvailableProviders, translate } from '../translate/functions'
import { providerIds } from '../translate/providers'
import type { ProviderChoice, ProviderId } from '../translate/providers'

interface Translation {
  original: string
  translation: string
  // provider that produced the translation
  provider?: string
  error?: string
}

interface TranslateState {
  translate: boolean
  isThinking: boolean
  translations: Array<Translation>
  provider: ProviderChoice
  availableProviders: Array<ProviderId> | null
  translateSelection: () => void
  toggleTranslate: () => void
  setProvider: (provider: ProviderChoice) => void
  loadAvailableProviders: () => Promise<void>
}

export const useTranslateStore = create<TranslateState>()(
  persist(
    (set, get) => {
      let currentAbortController: AbortController | null = null

      const updateTranslation = (
        index: number,
        patch: Partial<Translation>,
      ) => {
        const translations = [...get().translations]
        translations[index] = { ...translations[index], ...patch }
        set({ translations })
      }

      return {
        translate: true,
        isThinking: false,
        translations: [],
        provider: 'auto',
        availableProviders: null,
        translateSelection: async () => {
          if (!get().translate) return

          const selection = usePieceTableStore.getState().extractSelection()
          if (selection.length === 0) return

          // Cancel previous translation if it's running
          if (currentAbortController) {
            currentAbortController.abort()
          }

          const abortController = new AbortController()
          currentAbortController = abortController

          const index = get().translations.length
          const update = (patch: Partial<Translation>) =>
            updateTranslation(index, patch)
          set({
            isThinking: true,
            translations: [
              ...get().translations,
              { original: selection, translation: '' },
            ],
          })

          try {
            const res = await translate({
              data: { text: selection, provider: get().provider },
              signal: abortController.signal,
            })
            if (res.ok) {
              update({ translation: res.translation, provider: res.provider })
            } else {
              update({ error: res.errors.join('\n') })
            }
          } catch (err: any) {
            if (err.name === 'AbortError') {
              console.log('Previous translation canceled')
            } else {
              console.error(err)
              update({ error: 'Something went wrong' })
            }
          } finally {
            if (currentAbortController === abortController) {
              set({ isThinking: false })
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
      partialize: (state) => ({ provider: state.provider }),
      // a stored provider may have since been removed
      merge: (persisted, current) => {
        const provider = (persisted as Partial<TranslateState> | undefined)
          ?.provider
        const valid =
          provider === 'auto' || providerIds.some((id) => id === provider)
        return { ...current, provider: valid ? provider! : 'auto' }
      },
    },
  ),
)
