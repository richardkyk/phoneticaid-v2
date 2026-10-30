import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// View state that isn't part of a project (shared by all projects)

export type PanelTab = 'settings' | 'translations'

interface UiState {
  settingsOpen: boolean
  // on narrow screens the panel is a sheet from the bottom instead, starting
  // closed
  settingsDrawerOpen: boolean
  // which tab of the right panel is shown
  panelTab: PanelTab
  // a card with the meanings of the word under the pointer (or tapped)
  dictionary: boolean
  toggleSettings: () => void
  setSettingsDrawerOpen: (open: boolean) => void
  setPanelTab: (tab: PanelTab) => void
  toggleDictionary: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      settingsOpen: true,
      settingsDrawerOpen: false,
      panelTab: 'settings',
      dictionary: true,
      toggleSettings: () => set({ settingsOpen: !get().settingsOpen }),
      setSettingsDrawerOpen: (settingsDrawerOpen) =>
        set({ settingsDrawerOpen }),
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
