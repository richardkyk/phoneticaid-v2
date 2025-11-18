import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  deleteBackwards,
  getText,
  insertText,
  PieceTable,
  getPieceTableCursorPosition,
  deleteRange,
} from '../piece-table'
import { useCursorStore, PieceTableCursor } from './cursor-store'
import { useHistoryStore } from './history-store'

const blankPieceTable = (text = ''): PieceTable => ({
  original: text,
  add: '',
  pieces: text.length
    ? [{ buffer: 'original', start: 0, length: text.length }]
    : [],
})

export interface Project {
  id: string
  title: string
  pt: PieceTable
  lastUpdated: number
}

export interface MultiProjectState {
  projectCount: number
  projects: Project[]
  activeId: string

  getActiveProject: () => Project
  setActiveProject: (id: string) => void
  setActivePt: (pt: PieceTable) => void
  setActiveTitle: (title: string) => void
  addProject: () => Project
  deleteProject: (id: string) => void

  extractSelection: () => string
  deleteSelection: (pt: PieceTable) => PieceTableCursor | null
  insertAtCursor: (text: string) => void
  deleteAtCursor: (length: number) => void
}

export const usePieceTableStore = create<MultiProjectState>()(
  persist(
    (set, get) => ({
      projectCount: 0,
      projects: [],
      activeId: '',

      // --- Project Management ---
      getActiveProject: () => {
        const activeId = get().activeId
        if (!activeId) return get().addProject()

        const project = get().projects.find((p) => p.id === activeId)
        if (!project) return get().addProject()

        return project
      },
      setActiveProject: (id) => {
        const project = get().projects.find((p) => p.id === id)
        if (!project) return
        set({ activeId: project.id })
        useHistoryStore.getState().reset()
        useCursorStore.getState().reset()
      },
      setActivePt: (pt: PieceTable) => {
        const projects = structuredClone(get().projects)
        const projectIndex = projects.findIndex((p) => p.id === get().activeId)
        if (projectIndex === -1) return

        projects.splice(projectIndex, 1, {
          ...projects[projectIndex],
          pt,
          lastUpdated: Date.now(),
        })
        set({ projects: projects })
      },
      setActiveTitle: (title: string) => {
        const projects = structuredClone(get().projects)
        const projectIndex = projects.findIndex((p) => p.id === get().activeId)
        if (projectIndex === -1) return

        projects.splice(projectIndex, 1, {
          ...projects[projectIndex],
          title,
          lastUpdated: Date.now(),
        })
        set({ projects: projects })
      },
      addProject: () => {
        const nextProjectCount = get().projectCount + 1
        const newProject = {
          id: String(nextProjectCount),
          title: 'Untitled',
          pt: blankPieceTable(),
          lastUpdated: Date.now(),
        }
        set({
          projects: [...get().projects, newProject],
          projectCount: nextProjectCount,
          activeId: newProject.id,
        })
        return newProject
      },
      deleteProject: (id) => {
        const projects = get().projects.filter((p) => p.id !== id)
        const lastActiveProject = projects.sort(
          (a, b) => b.lastUpdated - a.lastUpdated,
        )
        set({
          projects,
          activeId: lastActiveProject.length > 0 ? lastActiveProject[0].id : '',
        })
      },

      // --- PieceTable Operations (act on active project) ---
      extractSelection: () => {
        const project = get().getActiveProject()
        const selection = useCursorStore.getState().getSelection()
        if (!selection) return ''

        const ptStart = getPieceTableCursorPosition(
          selection.start.row,
          selection.start.col,
        )
        const ptEnd = getPieceTableCursorPosition(
          selection.end.row,
          selection.end.col,
        )

        const extractStart = {
          pieceIndex: ptStart.pieceIndex < 0 ? 0 : ptStart.pieceIndex,
          charIndex:
            ptStart.pieceIndex < 0
              ? 0
              : ptStart.charIndex + (ptStart.offset > 0 ? 1 : 0),
        }
        const extractEnd = {
          pieceIndex: ptEnd.pieceIndex < 0 ? 0 : ptEnd.pieceIndex,
          charIndex:
            ptEnd.pieceIndex < 0
              ? 0
              : ptEnd.charIndex + (ptEnd.offset > 0 ? 1 : 0),
        }

        return getText(project.pt, extractStart, extractEnd)
      },

      deleteSelection: (pt: PieceTable) => {
        const selection = useCursorStore.getState().getSelection()
        const cursor = useCursorStore.getState()
        if (!selection) return null

        const ptStart = getPieceTableCursorPosition(
          selection.start.row,
          selection.start.col,
        )
        const ptEnd = getPieceTableCursorPosition(
          selection.end.row,
          selection.end.col,
        )

        if (ptStart.pieceIndex === ptEnd.pieceIndex) {
          if (ptStart.pieceIndex === -1) {
            cursor.resetSelection()
            return null
          }

          if (ptStart.charIndex === ptEnd.charIndex) {
            if (ptStart.offset === ptEnd.offset) {
              // the selection is referencing the same cursor position
              // i.e. nothing is actually selected
              cursor.resetSelection()
              return null
            }

            if (ptStart.offset > 0 && ptEnd.offset > 0) {
              // the selection only contains padding since they reference the same piece
              cursor.resetSelection()
              return null
            }
          }
        }

        let deleteStart = {
          pieceIndex: ptStart.pieceIndex,
          charIndex: ptStart.charIndex + (ptStart.offset > 0 ? 1 : 0),
        }

        if (ptStart.pieceIndex === -1) {
          // special case where the selection starts in padding (i.e. its reference piece is -1)
          // so we need to reference the piece at pieceIndex 0 and charIndex 0 so that it can be deleted
          deleteStart.pieceIndex = 0
          deleteStart.charIndex = ptStart.charIndex
        }

        const deleteEnd = {
          pieceIndex: ptEnd.pieceIndex,
          charIndex: ptEnd.charIndex + (ptEnd.offset > 0 ? 1 : 0),
        }
        cursor.resetSelection()
        return deleteRange(pt, deleteStart, deleteEnd)
      },

      insertAtCursor: (text: string) => {
        const cursor = useCursorStore.getState()
        let newCursor = {
          pieceIndex: cursor.pieceIndex,
          charIndex: cursor.charIndex,
          offset: cursor.offset,
        }

        const originalProject = get().getActiveProject()
        const originalPt = structuredClone(originalProject.pt)
        const pt = structuredClone(originalProject.pt)
        const selection = useCursorStore.getState().getSelection()
        if (selection) {
          get().deleteSelection(pt)
          newCursor = getPieceTableCursorPosition(
            selection.start.row,
            selection.start.col,
          )
        }

        let newText = ''
        if (newCursor.offset > 0) {
          if (text !== '\n') {
            newText = ' '.repeat(
              newCursor.offset - (newCursor.pieceIndex === -1 ? 0 : 1),
            )
          }
          // if there is an offset, it means we need to insert after the specified character (thus we have charIndex++)
          newCursor.charIndex++
        }
        newText += text

        const res = insertText(
          pt,
          newCursor.pieceIndex,
          newCursor.charIndex,
          newText,
        )
        useCursorStore
          .getState()
          .setCursorByPiece(res.pieceIndex, res.charIndex, 1)

        // pt should now be mutated to its final state
        const newPt = structuredClone(pt)
        const history = useHistoryStore.getState()
        history.push({
          undo: () => {
            usePieceTableStore.getState().setActivePt(originalPt)
            useCursorStore
              .getState()
              .setCursorByPiece(
                cursor.pieceIndex,
                cursor.charIndex,
                cursor.offset,
              )
          },
          redo: () => {
            usePieceTableStore.getState().setActivePt(newPt)
            useCursorStore
              .getState()
              .setCursorByPiece(res.pieceIndex, res.charIndex, 1)
          },
        })

        get().setActivePt(pt)
      },

      deleteAtCursor: (length: number) => {
        const cursor = useCursorStore.getState()
        let newCursor = {
          pieceIndex: cursor.pieceIndex,
          charIndex: cursor.charIndex,
          offset: cursor.offset,
        }

        const history = useHistoryStore.getState()
        const originalProject = get().getActiveProject()
        const originalPt = structuredClone(originalProject.pt)
        const pt = structuredClone(originalProject.pt)
        const selection = useCursorStore.getState().getSelection()
        if (selection) {
          const _newCursor = get().deleteSelection(pt)
          if (_newCursor) newCursor = _newCursor
          useCursorStore
            .getState()
            .setCursorByPiece(
              newCursor.pieceIndex,
              newCursor.charIndex,
              newCursor.offset,
            )
          history.push({
            undo: () => {
              usePieceTableStore.getState().setActivePt(originalPt)
              useCursorStore
                .getState()
                .setCursorByPiece(
                  cursor.pieceIndex,
                  cursor.charIndex,
                  cursor.offset,
                )
            },
            redo: () => {
              usePieceTableStore.getState().setActivePt(pt)
              useCursorStore
                .getState()
                .setCursorByPiece(
                  newCursor.pieceIndex,
                  newCursor.charIndex,
                  newCursor.offset,
                )
            },
          })

          get().setActivePt(pt)
          return
        }

        if (length === 0) return

        if (
          cursor.pieceIndex <= 0 &&
          cursor.charIndex === 0 &&
          cursor.offset === 0
        )
          return
        if (cursor.offset > 1 || cursor.pieceIndex === -1) {
          // if pieceIndex is -1, it means we are at the start of the document so there's nothing to delete
          useCursorStore
            .getState()
            .setCursorByPiece(
              cursor.pieceIndex,
              cursor.charIndex,
              cursor.offset - 1,
            )
          return
        }

        newCursor = deleteBackwards(
          pt,
          cursor.pieceIndex,
          cursor.charIndex,
          cursor.offset,
        )

        useCursorStore
          .getState()
          .setCursorByPiece(
            newCursor.pieceIndex,
            newCursor.charIndex,
            newCursor.offset,
          )

        // pt should now be mutated to its final state
        const newPt = structuredClone(pt)
        history.push({
          projectId: get().activeId,
          undo: () => {
            usePieceTableStore.getState().setActivePt(originalPt)
            useCursorStore
              .getState()
              .setCursorByPiece(
                cursor.pieceIndex,
                cursor.charIndex,
                cursor.offset,
              )
          },
          redo: () => {
            usePieceTableStore.getState().setActivePt(newPt)
            useCursorStore
              .getState()
              .setCursorByPiece(
                newCursor.pieceIndex,
                newCursor.charIndex,
                newCursor.offset,
              )
          },
        })

        get().setActivePt(pt)
      },
    }),
    {
      name: 'multi-project-piece-table',
      partialize: (state) => {
        const projects = structuredClone(state.projects)
        const activeProjectId = projects.findIndex(
          (p) => p.id === state.activeId,
        )
        if (activeProjectId >= 0) {
          const activeProject = projects[activeProjectId]
          const text = getText(activeProject.pt) // flatten piece table to string

          projects.splice(activeProjectId, 1, {
            ...activeProject,
            pt: {
              original: text,
              add: '',
              pieces: text.length
                ? [{ buffer: 'original', start: 0, length: text.length }]
                : [],
            },
          })
        }

        return {
          projectCount: state.projectCount,
          projects: projects,
          activeId: state.activeId,
        }
      },
    },
  ),
)
