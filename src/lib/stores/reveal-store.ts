import { create } from 'zustand'

// Hidden pinyin that's being looked at on screen. This is never printed.

interface RevealState {
  // character under the pointer (or last tapped), whose word is revealed
  hovered: number | null
  // the pointer's on its pinyin rather than the character itself
  onPinyin: boolean
  // all hidden pinyin is shown while the peek key is held
  peeking: boolean
  setHovered: (index: number | null, onPinyin?: boolean) => void
  setPeeking: (peeking: boolean) => void
}

export const useRevealStore = create<RevealState>()((set, get) => ({
  hovered: null,
  onPinyin: false,
  peeking: false,
  setHovered: (hovered, onPinyin = false) => {
    if (get().hovered !== hovered || get().onPinyin !== onPinyin) {
      set({ hovered, onPinyin })
    }
  },
  setPeeking: (peeking) => {
    if (get().peeking !== peeking) set({ peeking })
  },
}))
