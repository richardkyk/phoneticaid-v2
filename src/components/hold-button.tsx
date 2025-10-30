import React, { useRef } from 'react'
import { Button } from './ui/button'

interface HoldButtonProps extends React.ComponentProps<typeof Button> {
  onClick: () => void
  interval?: number // ms between repeated clicks
  children: React.ReactNode
}

export const HoldButton: React.FC<HoldButtonProps> = ({
  onClick,
  interval = 100, // default: 100ms
  children,
  ...props
}) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const handleMouseDown = () => {
    // Call once immediately
    onClick()

    // Start repeating
    intervalRef.current = setInterval(onClick, interval)
  }

  const clear = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  return (
    <Button
      onMouseDown={handleMouseDown}
      onMouseUp={clear}
      onMouseLeave={clear} // stop if mouse leaves button
      onTouchStart={handleMouseDown}
      onTouchEnd={clear}
      onTouchCancel={clear}
      {...props}
    >
      {children}
    </Button>
  )
}
