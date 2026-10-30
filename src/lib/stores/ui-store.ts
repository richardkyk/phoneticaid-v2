import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// View state that isn't part of a project (shared by all projects)

export type PanelTab = 'settings' | 'translations'

interface UiState {
  settingsOpen: boolean
  // which tab of the right panel is shown
  panelTab: PanelTab
  // a card with the meanings of the word under the pointer (or tapped)
  dictionary: boolean
  toggleSettings: () => void
  setPanelTab: (tab: PanelTab) => void
  toggleDictionary: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      settingsOpen: true,
      panelTab: 'settings',
      dictionary: true,
      toggleSettings: () => set({ settingsOpen: !get().settingsOpen }),
      setPanelTab: (panelTab) => set({ panelTab }),
      toggleDictionary: () => set({ dictionary: !get().dictionary }),
    }),
    {
      name: 'ui-settings',
      partialize: (state) => ({
        settingsOpen: state.settingsOpen,
        panelTab: state.panelTab,
        dictionary: state.dictionary,
      }),
    },
  ),
)
