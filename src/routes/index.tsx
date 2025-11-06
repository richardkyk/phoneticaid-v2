import { Document } from '@/components/document'
import { Translator } from '@/components/translator'
import { Toaster } from '@/components/ui/sonner'
import { createFileRoute } from '@tanstack/react-router'
import { Fragment } from 'react/jsx-runtime'

export const Route = createFileRoute('/')({
  component: App,
  ssr: false,
})

function App() {
  return (
    <Fragment>
      <Translator />
      <Document />
      <Toaster position="top-right" />
    </Fragment>
  )
}
