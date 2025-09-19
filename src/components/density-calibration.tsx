import { useDocumentStore } from '@/lib/document-store'
import { useLayoutEffect, useRef } from 'react'

export default function DensityCalibration() {
  const divRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!divRef.current) return

    const rect = divRef.current.getBoundingClientRect()
    useDocumentStore.getState().setMmX(rect.width)
    useDocumentStore.getState().setMmY(rect.height)
  }, [])

  return <div ref={divRef} className="absolute w-[1mm] h-[1mm]"></div>
}
