import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getText, PieceTable } from '../piece-table'
import { useCursorStore } from './cursor-store'
import { useHistoryStore } from './history-store'
import { useTranslateStore } from './translate-store'
import type { ChosenReadings } from '../words'
import type { SyncedProject } from '../sync/functions'
import { newId } from '../utils'
import {
  defaultDocumentState,
  DocumentState,
  useDocumentStore,
} from './document-store'

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
  // readings chosen with AI (see readings.ts)
  readings?: ChosenReadings
  // readings picked on the dictionary card, which win over the others
  pickedReadings?: ChosenReadings
  lastUpdated: number
}

export interface MultiProjectState {
  projectCount: number
  projects: Project[]
  activeId: string
  // when each deleted project was deleted, so other devices delete it too
  deleted: Record<string, number>

  getActiveProject: () => Project
  setActiveProject: (id: string) => void
  setActiveProjectAttribute: <K extends keyof Project>(
    attrs: Pick<Project, K>,
  ) => void
  addProject: () => Project
  // copies a project's text and settings into a new project
  duplicateProject: (id: string) => Project | undefined
  deleteProject: (id: string) => void
  // takes in projects changed on other devices, where they're newer
  applySynced: (synced: Array<SyncedProject>) => void
  // gives a project a new id (projects were once numbered on each device, so
  // the same id could mean different projects on different devices)
  renameProject: (id: string, newId: string) => void
}

// shows the active project's page settings, without counting as an edit
const loadDocument = (project: Project) =>
  useDocumentStore.setState({ ...defaultDocumentState(), ...project.doc })

export const useProjectsStore = create<MultiProjectState>()(
  persist(
    (set, get) => ({
      projectCount: 0,
      projects: [],
      activeId: '',
      deleted: {},

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
        const previousId = get().activeId || null
        if (previousId === project.id) return
        set({ activeId: project.id })
        // each project keeps its own undo/redo history
        useHistoryStore.getState().switchProject(previousId, project.id)
        useCursorStore.getState().reset()
        loadDocument(project)
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
          id: newId(),
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
      duplicateProject: (id) => {
        const project = get().projects.find((p) => p.id === id)
        if (!project) return
        const nextProjectCount = get().projectCount + 1
        const copy = {
          id: newId(),
          title: `${project.title} (copy)`,
          pt: blankPieceTable(getText(project.pt)),
          doc: structuredClone(project.doc),
          readings: structuredClone(project.readings),
          pickedReadings: structuredClone(project.pickedReadings),
          lastUpdated: Date.now(),
        }
        set({
          projects: [...get().projects, copy],
          projectCount: nextProjectCount,
        })
        return copy
      },
      deleteProject: (id) => {
        const projects = get().projects.filter((p) => p.id !== id)
        set({ projects, deleted: { ...get().deleted, [id]: Date.now() } })
        useHistoryStore.getState().forgetProject(id)
        useTranslateStore.getState().forgetProject(id)
        if (id !== get().activeId) return

        // the active project was deleted, switch to the most recently updated one
        const [next] = [...projects].sort(
          (a, b) => b.lastUpdated - a.lastUpdated,
        )
        useHistoryStore.getState().reset()
        set({ activeId: '' })
        if (next) get().setActiveProject(next.id)
      },
      applySynced: (synced) => {
        let projects = get().projects
        const deleted = { ...get().deleted }
        let activeChanged = false
        let activeDeleted = false
        let changed = false

        for (const remote of synced) {
          const local = projects.find((p) => p.id === remote.id)
          if (remote.deleted) {
            // edited here after it was deleted elsewhere, so it's kept
            if (!local || local.lastUpdated > remote.updatedAt) continue
            projects = projects.filter((p) => p.id !== remote.id)
            deleted[remote.id] = remote.updatedAt
            changed = true
            if (remote.id === get().activeId) activeDeleted = true
            continue
          }
          if (!remote.data) continue
          if ((deleted[remote.id] ?? -Infinity) >= remote.updatedAt) continue
          if (local && local.lastUpdated >= remote.updatedAt) continue

          const project: Project = {
            id: remote.id,
            title: remote.data.title,
            pt: blankPieceTable(remote.data.text),
            doc: {
              ...defaultDocumentState(),
              ...(remote.data.doc as Partial<DocumentState>),
            },
            readings: remote.data.readings as ChosenReadings | undefined,
            pickedReadings: remote.data.pickedReadings as
              ChosenReadings | undefined,
            lastUpdated: remote.updatedAt,
          }
          delete deleted[remote.id]
          projects = local
            ? projects.map((p) => (p.id === remote.id ? project : p))
            : [...projects, project]
          if (remote.id === get().activeId) activeChanged = true
          changed = true
        }

        // only set when something came down: any change to the projects
        // schedules another sync, so setting every time would loop
        if (changed) set({ projects, deleted })
        for (const remote of synced) {
          if (remote.deleted) {
            useHistoryStore.getState().forgetProject(remote.id)
            useTranslateStore.getState().forgetProject(remote.id)
          }
        }

        if (activeDeleted) {
          useHistoryStore.getState().reset()
          set({ activeId: '' })
          const [next] = [...projects].sort(
            (a, b) => b.lastUpdated - a.lastUpdated,
          )
          if (next) get().setActiveProject(next.id)
        } else if (activeChanged) {
          // the undo history and cursor were for the text it replaced
          useHistoryStore.getState().reset()
          useCursorStore.getState().reset()
          loadDocument(get().getActiveProject())
        }
      },
      renameProject: (id, to) => {
        set({
          projects: get().projects.map((p) =>
            p.id === id ? { ...p, id: to } : p,
          ),
          activeId: get().activeId === id ? to : get().activeId,
        })
        useHistoryStore.getState().renameProject(id, to)
        useTranslateStore.getState().renameProject(id, to)
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
          deleted: state.deleted,
        }
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const activeId = state.activeId
        if (!activeId) return

        const project = state.projects.find((p) => p.id === activeId)
        if (!project) return
        loadDocument(project)
      },
    },
  ),
)
