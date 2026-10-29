import { create } from 'zustand'

// Hidden pinyin that's being looked at on screen. This is never printed.

interface RevealState {
  // character under the pointer (or last tapped), whose word is revealed
  hovered: number | null
  // all hidden pinyin is shown while the peek key is held
  peeking: boolean
  setHovered: (index: number | null) => void
  setPeeking: (peeking: boolean) => void
}

export const useRevealStore = create<RevealState>()((set, get) => ({
  hovered: null,
  peeking: false,
  setHovered: (hovered) => {
    if (get().hovered !== hovered) set({ hovered })
  },
  setPeeking: (peeking) => {
    if (get().peeking !== peeking) set({ peeking })
  },
}))
