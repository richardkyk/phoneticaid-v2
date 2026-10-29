import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// View state that isn't part of a project (shared by all projects)

export type PanelTab = 'settings' | 'translations'

interface UiState {
  settingsOpen: boolean
  // which tab of the right panel is shown
  panelTab: PanelTab
  toggleSettings: () => void
  setPanelTab: (tab: PanelTab) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      settingsOpen: true,
      panelTab: 'settings',
      toggleSettings: () => set({ settingsOpen: !get().settingsOpen }),
      setPanelTab: (panelTab) => set({ panelTab }),
    }),
    {
      name: 'ui-settings',
      partialize: (state) => ({
        settingsOpen: state.settingsOpen,
        panelTab: state.panelTab,
      }),
    },
  ),
)
