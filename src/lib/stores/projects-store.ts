import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getText, PieceTable } from '../piece-table'
import { useCursorStore } from './cursor-store'
import { useHistoryStore } from './history-store'
import { defaultDocumentState, DocumentState } from './document-store'

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
  doc: DocumentState
  lastUpdated: number
}

export interface MultiProjectState {
  projectCount: number
  projects: Project[]
  activeId: string

  getActiveProject: () => Project
  setActiveProject: (id: string) => void
  setActiveProjectAttribute: <K extends keyof Project>(
    attrs: Pick<Project, K>,
  ) => void
  addProject: () => Project
  deleteProject: (id: string) => void
}

export const useProjectsStore = create<MultiProjectState>()(
  persist(
    (set, get) => ({
      projectCount: 0,
      projects: [],
      activeId: '',

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
      setActiveProjectAttribute: (attr) => {
        const projects = structuredClone(get().projects)
        const projectIndex = projects.findIndex((p) => p.id === get().activeId)
        if (projectIndex === -1) return

        projects.splice(projectIndex, 1, {
          ...projects[projectIndex],
          ...attr,
          lastUpdated: Date.now(),
        })
        set({ projects: projects })
      },
      addProject: () => {
        const nextProjectCount = get().projectCount + 1
        const newProject = {
          id: String(nextProjectCount),
          title: `Untitled #${nextProjectCount}`,
          pt: blankPieceTable(),
          doc: defaultDocumentState(),
          lastUpdated: Date.now(),
        }
        set({
          projects: [...get().projects, newProject],
          projectCount: nextProjectCount,
        })
        get().setActiveProject(newProject.id)
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
