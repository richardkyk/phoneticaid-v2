import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { env } from 'cloudflare:workers'
import { getAuth } from './lib/auth'

// The worker's entry: TanStack Start, plus the sync websocket, which goes to
// the signed in user's SyncRoom

export { SyncRoom } from './lib/sync/room'

const SYNC_SOCKET = '/api/sync/socket'

export default createServerEntry({
  async fetch(request, opts) {
    if (new URL(request.url).pathname === SYNC_SOCKET) {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected a websocket', { status: 426 })
      }
      const session = await (
        await getAuth()
      ).api.getSession({ headers: request.headers })
      if (!session) return new Response('Signed out', { status: 401 })
      const room = env.SYNC_ROOM.get(env.SYNC_ROOM.idFromName(session.user.id))
      return room.fetch(request)
    }
    return handler.fetch(request, opts)
  },
})
