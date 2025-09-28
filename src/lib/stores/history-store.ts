import { create } from 'zustand'

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
    const action = get().past.pop()
    if (!action) return
    action.undo()
    set((state) => ({ future: [action, ...state.future], past: state.past }))
  },
  redo: () => {
    const action = get().future.shift()
    if (!action) return
    action.redo()
    set((state) => ({ past: [...state.past, action], future: state.future }))
  },
}))
