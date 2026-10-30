import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { env } from '@/env'

// Server-only: only import this from server routes and inside server function
// handlers

const createAuth = async () => {
  const { env: cf } = await import('cloudflare:workers')
  return betterAuth({
    database: cf.DB,
    secret: env.BETTER_AUTH_SECRET,
    // the origin is taken from each request, so sign-in works on localhost and
    // the deployed site alike
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
              prompt: 'select_account',
            },
          }
        : {},
    session: {
      // a year, refreshed daily while the app is used
      expiresIn: 60 * 60 * 24 * 365,
    },
    plugins: [tanstackStartCookies()],
  })
}

let auth: ReturnType<typeof createAuth> | undefined
export const getAuth = () => (auth ??= createAuth())

// The signed in user of the current request, if any
export async function currentUserId() {
  const { getRequestHeaders } = await import('@tanstack/react-start/server')
  const session = await (
    await getAuth()
  ).api.getSession({ headers: getRequestHeaders() })
  return session?.user.id
}
