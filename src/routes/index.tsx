import DensityCalibration from '@/components/density-calibration'
import { Document } from '@/components/document'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: App,
})

function App() {
  return (
    <div className="container mx-auto p-6 flex items-center justify-center">
      <DensityCalibration />
      <Document />
    </div>
  )
}
