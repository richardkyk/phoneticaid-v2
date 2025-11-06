import React, { useRef } from 'react'
import { Button } from './ui/button'

interface HoldButtonProps extends React.ComponentProps<typeof Button> {
  onClick: () => void
  interval?: number
  children: React.ReactNode
}

export const HoldButton: React.FC<HoldButtonProps> = ({
  onClick,
  interval = 100,
  children,
  ...props
}) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const touchActiveRef = useRef(false)

  const handleMouseDown = () => {
    if (touchActiveRef.current) return
    onClick()
    intervalRef.current = setInterval(onClick, interval)
  }

  const handleTouchStart = () => {
    touchActiveRef.current = true
    onClick()
    intervalRef.current = setInterval(onClick, interval)
  }

  const clear = () => {
    touchActiveRef.current = false
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  return (
    <Button
      onMouseDown={handleMouseDown}
      onMouseUp={clear}
      onMouseLeave={clear}
      onTouchStart={handleTouchStart}
      onTouchEnd={clear}
      onTouchCancel={clear}
      {...props}
    >
      {children}
    </Button>
  )
}
