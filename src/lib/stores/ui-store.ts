import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// View state that isn't part of a project (shared by all projects)

interface UiState {
  settingsOpen: boolean
  toggleSettings: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      settingsOpen: true,
      toggleSettings: () => set({ settingsOpen: !get().settingsOpen }),
    }),
    {
      name: 'ui-settings',
      partialize: (state) => ({
        settingsOpen: state.settingsOpen,
      }),
    },
  ),
)
