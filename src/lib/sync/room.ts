import { DurableObject } from 'cloudflare:workers'

// One per signed in user, holding a websocket for each of their open tabs.
// When a sync changes something on the server, the user's other tabs are told
// to sync, so their edits show up straight away rather than at the next poll.
// The sockets hibernate between messages, so an idle room costs nothing.
export class SyncRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // keepalive pings are answered without waking the room
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong'),
    )
  }

  // a tab connecting, `client` identifies it so it isn't told of its own syncs
  fetch(request: Request) {
    const client = new URL(request.url).searchParams.get('client') || 'none'
    const { 0: socket, 1: server } = new WebSocketPair()
    this.ctx.acceptWebSocket(server, [client])
    return new Response(null, { status: 101, webSocket: socket })
  }

  // a sync from `client` changed the user's projects or settings
  notify(client: string) {
    for (const ws of this.ctx.getWebSockets()) {
      if (this.ctx.getTags(ws).includes(client)) continue
      try {
        ws.send('changed')
      } catch {
        // already closing
      }
    }
  }

  webSocketClose(ws: WebSocket, code: number) {
    try {
      ws.close(code)
    } catch {
      // codes like 1006 can't be sent back
    }
  }
}
