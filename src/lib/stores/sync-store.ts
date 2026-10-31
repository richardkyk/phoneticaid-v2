import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getText } from '../piece-table'
import { providerIds } from '../translate/providers'
import { sync } from '../sync/functions'
import type { SyncedProject } from '../sync/functions'
import type { ProviderChoice } from '../translate/providers'
import { newId } from '../utils'
import { useProjectsStore } from './projects-store'
import { useTranslateStore } from './translate-store'
import { useUiStore } from './ui-store'

// Keeps a signed in user's projects and app settings the same on all their
// devices. Each project syncs as a whole and the newest edit wins

// after an edit, so typing doesn't sync every keystroke
const DEBOUNCE = 2000
// other devices' changes arrive over a websocket (see src/lib/sync/room.ts),
// this picks them up instead while it's disconnected
const POLL_INTERVAL = 60_000
// keeps the websocket from being dropped as idle
const PING_INTERVAL = 30_000
// the longest wait before reconnecting, doubling up to it from a second
const MAX_RECONNECT_DELAY = 30_000

// this tab, so the server doesn't tell it about its own syncs
const clientId = newId()

export type SyncStatus = 'idle' | 'syncing' | 'error'

interface SyncState {
  // the account this device last synced with
  userId: string | null
  // from the last sync, the server sends what changed since
  cursor: number
  // per project, the lastUpdated (or deletion time) the server has, so only
  // projects changed since are sent
  pushed: Record<string, number>
  // the settings below last changed at, and what the server has
  settingsUpdatedAt: number
  settingsPushed: number
  status: SyncStatus
  lastSynced: number | null
  // starts syncing for a signed in user, returns a function that stops
  start: (userId: string) => () => void
  syncNow: () => Promise<void>
}

// App settings shared between devices (the rest are per device, like whether
// the panel is open)
const readSettings = () => ({
  dictionary: useUiStore.getState().dictionary,
  provider: useTranslateStore.getState().provider,
})

let applyingSettings = false
const applySettings = (data: Record<string, unknown>) => {
  applyingSettings = true
  if (typeof data.dictionary === 'boolean') {
    useUiStore.setState({ dictionary: data.dictionary })
  }
  const provider = data.provider as ProviderChoice
  if (provider === 'auto' || providerIds.includes(provider as never)) {
    useTranslateStore.setState({ provider })
  }
  applyingSettings = false
}

// projects were numbered on each device (1, 2, ...) before syncing, so the
// same id could be different projects on different devices
const LEGACY_ID = /^\d+$/

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => {
      let running: Promise<void> | null = null
      let again = false

      const changedProjects = (): Array<SyncedProject> => {
        const { projects, deleted } = useProjectsStore.getState()
        const { pushed } = get()
        const changed: Array<SyncedProject> = projects
          .filter((p) => pushed[p.id] !== p.lastUpdated)
          .map((p) => ({
            id: p.id,
            updatedAt: p.lastUpdated,
            deleted: false,
            data: {
              title: p.title,
              text: getText(p.pt),
              doc: { ...p.doc },
              readings: p.readings,
              pickedReadings: p.pickedReadings,
            },
          }))
        for (const [id, at] of Object.entries(deleted)) {
          if (pushed[id] !== at) {
            changed.push({ id, updatedAt: at, deleted: true })
          }
        }
        return changed
      }

      const runOnce = async () => {
        const projects = changedProjects()
        const { settingsUpdatedAt, settingsPushed, cursor } = get()
        const settings =
          settingsUpdatedAt !== settingsPushed
            ? { updatedAt: settingsUpdatedAt, data: readSettings() }
            : undefined

        const res = await sync({
          data: { since: cursor, projects, settings, client: clientId },
        })
        if (!res.ok) throw new Error(res.error)

        // what was sent is on the server now (or the server had newer)
        const pushed = { ...get().pushed }
        for (const p of projects) pushed[p.id] = p.updatedAt

        useProjectsStore.getState().applySynced(res.projects)
        // projects taken from the server don't need sending back
        const { projects: local, deleted } = useProjectsStore.getState()
        for (const remote of res.projects) {
          const project = local.find((p) => p.id === remote.id)
          if (project && project.lastUpdated === remote.updatedAt) {
            pushed[remote.id] = remote.updatedAt
          } else if (!project && deleted[remote.id] === remote.updatedAt) {
            pushed[remote.id] = remote.updatedAt
          }
        }

        let settingsState = {
          settingsPushed: settings?.updatedAt ?? get().settingsPushed,
        } as Partial<SyncState>
        if (res.settings && res.settings.updatedAt > get().settingsUpdatedAt) {
          applySettings(res.settings.data)
          settingsState = {
            settingsUpdatedAt: res.settings.updatedAt,
            settingsPushed: res.settings.updatedAt,
          }
        }

        set({ ...settingsState, pushed, cursor: res.cursor })
      }

      return {
        userId: null,
        cursor: 0,
        pushed: {},
        settingsUpdatedAt: 0,
        settingsPushed: 0,
        status: 'idle',
        lastSynced: null,
        syncNow: async () => {
          if (!get().userId) return
          if (running) {
            again = true
            return running
          }
          set({ status: 'syncing' })
          running = (async () => {
            try {
              do {
                again = false
                await runOnce()
              } while (again)
              set({ status: 'idle', lastSynced: Date.now() })
            } catch (err) {
              console.error('Sync failed', err)
              set({ status: 'error' })
            } finally {
              running = null
            }
          })()
          return running
        },
        start: (userId) => {
          if (get().userId !== userId) {
            // a new account for this device: everything here is merged into
            // the account's projects, and all of theirs come down
            for (const p of useProjectsStore.getState().projects) {
              if (LEGACY_ID.test(p.id)) {
                useProjectsStore.getState().renameProject(p.id, newId())
              }
            }
            set({
              userId,
              cursor: 0,
              pushed: {},
              // this device's settings are sent as the oldest, so the
              // account's win if it has any
              settingsUpdatedAt: 0,
              settingsPushed: -1,
            })
          }

          let timer: ReturnType<typeof setTimeout> | undefined
          const later = () => {
            clearTimeout(timer)
            timer = setTimeout(() => get().syncNow(), DEBOUNCE)
          }

          const unsubscribeProjects = useProjectsStore.subscribe(
            (state, prev) => {
              if (
                state.projects !== prev.projects ||
                state.deleted !== prev.deleted
              ) {
                later()
              }
            },
          )
          const settingsChanged = () => {
            if (applyingSettings) return
            set({ settingsUpdatedAt: Date.now() })
            later()
          }
          const unsubscribeUi = useUiStore.subscribe((state, prev) => {
            if (state.dictionary !== prev.dictionary) settingsChanged()
          })
          const unsubscribeTranslate = useTranslateStore.subscribe(
            (state, prev) => {
              if (state.provider !== prev.provider) settingsChanged()
            },
          )

          // told by the server when another tab or device changed something
          let socket: WebSocket | null = null
          let connected = false
          let reconnects = 0
          let reconnectTimer: ReturnType<typeof setTimeout> | undefined
          let stopped = false
          const connect = () => {
            clearTimeout(reconnectTimer)
            if (stopped || socket) return
            const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
            const ws = new WebSocket(
              `${protocol}://${location.host}/api/sync/socket?client=${clientId}`,
            )
            socket = ws
            ws.onopen = () => {
              reconnects = 0
              // changes made while it was disconnected weren't announced
              if (connected) get().syncNow()
              connected = true
            }
            ws.onmessage = (e) => {
              if (e.data === 'changed') get().syncNow()
            }
            ws.onclose = () => {
              socket = null
              if (stopped) return
              const delay = Math.min(
                1000 * 2 ** reconnects++,
                MAX_RECONNECT_DELAY,
              )
              reconnectTimer = setTimeout(connect, delay)
            }
          }
          const isOpen = () => socket?.readyState === WebSocket.OPEN
          const ping = setInterval(() => {
            if (isOpen()) socket?.send('ping')
          }, PING_INTERVAL)

          const onVisible = () => {
            if (document.visibilityState !== 'visible') return
            // a phone may have dropped the socket while the app was hidden
            connect()
            get().syncNow()
          }
          document.addEventListener('visibilitychange', onVisible)
          const poll = setInterval(() => {
            if (document.visibilityState === 'visible' && !isOpen()) {
              get().syncNow()
            }
          }, POLL_INTERVAL)

          connect()
          get().syncNow()

          return () => {
            stopped = true
            clearTimeout(reconnectTimer)
            socket?.close()
            clearInterval(ping)
            clearTimeout(timer)
            clearInterval(poll)
            document.removeEventListener('visibilitychange', onVisible)
            unsubscribeProjects()
            unsubscribeUi()
            unsubscribeTranslate()
          }
        },
      }
    },
    {
      name: 'sync-state',
      partialize: (state) => ({
        userId: state.userId,
        cursor: state.cursor,
        pushed: state.pushed,
        settingsUpdatedAt: state.settingsUpdatedAt,
        settingsPushed: state.settingsPushed,
        lastSynced: state.lastSynced,
      }),
    },
  ),
)
