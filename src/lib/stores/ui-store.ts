import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// View state that isn't part of a project (shared by all projects)

const ZOOM_LEVELS = [
  0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4,
]
export const MIN_ZOOM = ZOOM_LEVELS[0]
export const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1]

interface UiState {
  zoom: number
  settingsOpen: boolean
  setZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  toggleSettings: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      zoom: 1,
      settingsOpen: true,
      setZoom: (zoom) =>
        set({ zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) }),
      // step to the next preset zoom level
      zoomIn: () => {
        const next = ZOOM_LEVELS.find((z) => z > get().zoom + 0.001)
        get().setZoom(next ?? MAX_ZOOM)
      },
      zoomOut: () => {
        const prev = [...ZOOM_LEVELS]
          .reverse()
          .find((z) => z < get().zoom - 0.001)
        get().setZoom(prev ?? MIN_ZOOM)
      },
      toggleSettings: () => set({ settingsOpen: !get().settingsOpen }),
    }),
    {
      name: 'ui-settings',
      partialize: (state) => ({
        zoom: state.zoom,
        settingsOpen: state.settingsOpen,
      }),
    },
  ),
)
