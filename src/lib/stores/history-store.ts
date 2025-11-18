import { create } from 'zustand'
import { useCursorStore } from './cursor-store'

interface UndoAction {
  undo: () => void
  redo: () => void
}

interface HistoryState {
  past: UndoAction[]
  future: UndoAction[]
  push: (action: UndoAction) => void
  undo: () => void
  redo: () => void
  reset: () => void
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  push: (action) =>
    set((state) => ({
      past: [...state.past, action],
      future: [],
    })),
  undo: () => {
    useCursorStore.getState().resetSelection()
    const action = get().past.pop()
    if (!action) return
    action.undo()
    set((state) => ({ future: [action, ...state.future], past: state.past }))
  },
  redo: () => {
    useCursorStore.getState().resetSelection()
    const action = get().future.shift()
    if (!action) return
    action.redo()
    set((state) => ({ past: [...state.past, action], future: state.future }))
  },
  reset: () => {
    set({
      past: [],
      future: [],
    })
  },
}))
