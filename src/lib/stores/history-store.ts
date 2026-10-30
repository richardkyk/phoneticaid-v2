import { create } from 'zustand'
import { useCursorStore } from './cursor-store'

interface UndoAction {
  undo: () => void
  redo: () => void
}

interface History {
  past: UndoAction[]
  future: UndoAction[]
}

interface HistoryState extends History {
  // histories of the projects that aren't active, kept for this session only
  inactive: Record<string, History>
  push: (action: UndoAction) => void
  undo: () => void
  redo: () => void
  reset: () => void
  // parks the active history under `fromId` and restores the one for `toId`
  switchProject: (fromId: string | null, toId: string) => void
  forgetProject: (id: string) => void
  renameProject: (id: string, newId: string) => void
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  inactive: {},
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
  switchProject: (fromId, toId) => {
    if (fromId === toId) return
    const { past, future, inactive } = get()
    const { [toId]: next, ...rest } = inactive
    set({
      past: next?.past ?? [],
      future: next?.future ?? [],
      inactive: fromId ? { ...rest, [fromId]: { past, future } } : rest,
    })
  },
  forgetProject: (id) => {
    const { [id]: _, ...rest } = get().inactive
    set({ inactive: rest })
  },
  renameProject: (id, newId) => {
    const { [id]: history, ...rest } = get().inactive
    if (history) set({ inactive: { ...rest, [newId]: history } })
  },
}))
