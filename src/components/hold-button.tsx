import React, { useEffect, useRef } from 'react'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

// how long it's held before it starts repeating, in ms, so a slow tap is
// still one step
const REPEAT_DELAY = 400

interface HoldButtonProps extends React.ComponentProps<typeof Button> {
  onClick: () => void
  interval?: number
  children: React.ReactNode
}

// Steps once when pressed, then repeats while it's held. Pointer events fire
// once for a touch, where touch and mouse events both fire (iOS sends a mouse
// press after the touch ends)
export const HoldButton: React.FC<HoldButtonProps> = ({
  onClick,
  interval = 100,
  children,
  className,
  ...props
}) => {
  const timerRef = useRef<number | null>(null)

  const clear = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }
  useEffect(() => clear, [])

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    clear()
    onClick()
    timerRef.current = window.setTimeout(() => {
      timerRef.current = window.setInterval(onClick, interval)
    }, REPEAT_DELAY)
  }

  return (
    <Button
      onPointerDown={handlePointerDown}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      // a long press doesn't select text or open a menu
      onContextMenu={(e) => e.preventDefault()}
      className={cn('select-none', className)}
      {...props}
    >
      {children}
    </Button>
  )
}
