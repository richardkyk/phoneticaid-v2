import { createServerFn } from '@tanstack/react-start'
import z from 'zod'

// A project as it's synced: its text rather than its piece table
const ProjectDataSchema = z.object({
  title: z.string(),
  text: z.string(),
  doc: z.record(z.string(), z.any()),
  readings: z.record(z.string(), z.any()).optional(),
  pickedReadings: z.record(z.string(), z.any()).optional(),
})

const SyncedProjectSchema = z.object({
  id: z.string().min(1).max(64),
  // when the project was last edited, the newest edit wins
  updatedAt: z.number(),
  deleted: z.boolean(),
  data: ProjectDataSchema.optional(),
})

const SettingsSchema = z.object({
  updatedAt: z.number(),
  data: z.record(z.string(), z.any()),
})

const SyncSchema = z.object({
  // the cursor returned by the last sync, 0 for everything
  since: z.number(),
  // projects changed on this device since it last synced
  projects: z.array(SyncedProjectSchema),
  settings: SettingsSchema.optional(),
  // this tab, so the others are told of what it changed but it isn't
  client: z.string().max(64).optional(),
})

export type ProjectData = z.infer<typeof ProjectDataSchema>
export type SyncedProject = z.infer<typeof SyncedProjectSchema>
export type SyncedSettings = z.infer<typeof SettingsSchema>

export type SyncResult =
  | {
      ok: true
      cursor: number
      // projects changed on the server since `since` (including the ones just
      // sent)
      projects: Array<SyncedProject>
      settings: SyncedSettings | null
    }
  | { ok: false; error: 'signed-out' }

interface ProjectRow {
  id: string
  updated_at: number
  deleted: number
  data: string | null
  synced_at: number
}

// Sends this device's changes and gets everyone else's. Changes only replace
// what's on the server if they're newer
export const sync = createServerFn({ method: 'POST' })
  .validator(SyncSchema)
  .handler(async ({ data }): Promise<SyncResult> => {
    const { currentUserId } = await import('../auth')
    const userId = await currentUserId()
    if (!userId) return { ok: false, error: 'signed-out' }

    const { env: cf } = await import('cloudflare:workers')
    const db = cf.DB
    const now = Date.now()

    const writes = data.projects.map((p) =>
      db
        .prepare(
          `insert into project (user_id, id, updated_at, deleted, data, synced_at)
           values (?1, ?2, ?3, ?4, ?5, ?6)
           on conflict (user_id, id) do update set
             updated_at = excluded.updated_at,
             deleted = excluded.deleted,
             data = excluded.data,
             synced_at = excluded.synced_at
           where excluded.updated_at > project.updated_at`,
        )
        .bind(
          userId,
          p.id,
          p.updatedAt,
          p.deleted ? 1 : 0,
          p.deleted || !p.data ? null : JSON.stringify(p.data),
          now,
        ),
    )
    if (data.settings) {
      writes.push(
        db
          .prepare(
            `insert into settings (user_id, updated_at, data) values (?1, ?2, ?3)
             on conflict (user_id) do update set
               updated_at = excluded.updated_at,
               data = excluded.data
             where excluded.updated_at > settings.updated_at`,
          )
          .bind(
            userId,
            data.settings.updatedAt,
            JSON.stringify(data.settings.data),
          ),
      )
    }

    // >= rather than >, as another request may have written in the same
    // millisecond as the last cursor; getting a project twice is harmless
    const results = await db.batch<any>([
      ...writes,
      db
        .prepare(
          `select id, updated_at, deleted, data, synced_at from project
           where user_id = ?1 and synced_at >= ?2`,
        )
        .bind(userId, data.since),
      db
        .prepare(`select updated_at, data from settings where user_id = ?1`)
        .bind(userId),
    ])
    const [changes, settings] = results.slice(writes.length)

    // the user's other tabs sync now if this one changed anything (a write
    // that wasn't newer changes nothing)
    if (results.slice(0, writes.length).some((r) => r.meta.changes > 0)) {
      try {
        await cf.SYNC_ROOM.get(cf.SYNC_ROOM.idFromName(userId)).notify(
          data.client ?? '',
        )
      } catch (err) {
        // they'll still sync at their next poll or when they're next opened
        console.error('Sync notify failed', err)
      }
    }

    const rows = changes.results as Array<ProjectRow>
    const settingsRow = settings.results[0] as
      { updated_at: number; data: string } | undefined

    return {
      ok: true,
      cursor: Math.max(data.since, ...rows.map((r) => r.synced_at)),
      projects: rows.map((r) => ({
        id: r.id,
        updatedAt: r.updated_at,
        deleted: !!r.deleted,
        data: r.data ? (JSON.parse(r.data) as ProjectData) : undefined,
      })),
      settings: settingsRow
        ? {
            updatedAt: settingsRow.updated_at,
            data: JSON.parse(settingsRow.data) as Record<string, any>,
          }
        : null,
    }
  })
