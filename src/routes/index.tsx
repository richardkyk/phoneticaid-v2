import DensityCalibration from '@/components/density-calibration'
import { Document } from '@/components/document'
import { createFileRoute } from '@tanstack/react-router'
import { Fragment } from 'react/jsx-runtime'

export const Route = createFileRoute('/')({
  component: App,
})

function App() {
  return (
    <Fragment>
      <DensityCalibration />
      <Document />
    </Fragment>
  )
}
