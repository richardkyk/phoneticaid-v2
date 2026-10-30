import { createFileRoute } from '@tanstack/react-router'

// Better Auth's endpoints (sign in with Google, the session, sign out)
export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getAuth } = await import('@/lib/auth')
        return (await getAuth()).handler(request)
      },
      POST: async ({ request }) => {
        const { getAuth } = await import('@/lib/auth')
        return (await getAuth()).handler(request)
      },
    },
  },
})
