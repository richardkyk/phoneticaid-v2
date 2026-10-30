import { useEffect, useState } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import {
  CloudAlertIcon,
  CloudCheckIcon,
  LogOutIcon,
  RefreshCwIcon,
} from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { useProjectsStore } from '@/lib/stores/projects-store'
import { useSyncStore } from '@/lib/stores/sync-store'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

const PROJECT_PATH = /^\/projects\/([^/]+)/

// Syncs while someone is signed in, and keeps the open project's address
// right when syncing renames or deletes it
export function SyncRunner() {
  const { data: session } = authClient.useSession()
  const userId = session?.user.id
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    if (!userId) return
    return useSyncStore.getState().start(userId)
  }, [userId])

  // read from the store rather than its hook, which gives the empty server
  // state while the page hydrates
  useEffect(() => {
    const check = () => {
      const id = PROJECT_PATH.exec(pathname)?.[1]
      const { projects, activeId } = useProjectsStore.getState()
      if (!id || projects.some((p) => p.id === id)) return
      if (activeId && projects.some((p) => p.id === activeId)) {
        // renamed while open
        navigate({
          to: '/projects/$projectId',
          params: { projectId: activeId },
          replace: true,
        })
      } else {
        // deleted on another device
        navigate({ to: '/', replace: true })
      }
    }
    check()
    return useProjectsStore.subscribe(check)
  }, [pathname, navigate])

  return null
}

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

function syncedAgo(time: number) {
  const minutes = Math.floor((Date.now() - time) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return relativeTime.format(-minutes, 'minute')
  return relativeTime.format(-Math.floor(minutes / 60), 'hour')
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.55 10.55 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  )
}

// Signing in with Google syncs projects between devices
export function AccountMenu() {
  const { data: session, isPending } = authClient.useSession()
  const status = useSyncStore((state) => state.status)
  const lastSynced = useSyncStore((state) => state.lastSynced)
  // re-renders the "synced ... ago" now and then
  const [, setNow] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  if (isPending) return null

  if (!session) {
    return (
      <Button
        variant="outline"
        size="sm"
        title="Sign in to sync your projects between devices"
        onClick={() =>
          authClient.signIn.social({
            provider: 'google',
            callbackURL: window.location.pathname,
          })
        }
      >
        <GoogleIcon />
        Sign in
      </Button>
    )
  }

  const { user } = session
  const StatusIcon = status === 'error' ? CloudAlertIcon : CloudCheckIcon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          title={user.name}
        >
          <Avatar className="size-7">
            {user.image && <AvatarImage src={user.image} alt="" />}
            <AvatarFallback>{user.name.slice(0, 1)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-sm font-medium">{user.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {user.email}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
          <StatusIcon className="size-4" />
          {status === 'syncing'
            ? 'Syncing…'
            : status === 'error'
              ? "Couldn't sync"
              : lastSynced
                ? `Synced ${syncedAgo(lastSynced)}`
                : 'Not synced yet'}
        </DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            useSyncStore.getState().syncNow()
          }}
        >
          <RefreshCwIcon />
          Sync now
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* projects stay on this device after signing out */}
        <DropdownMenuItem onClick={() => authClient.signOut()}>
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
