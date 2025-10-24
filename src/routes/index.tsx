import { Document } from '@/components/document'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: App,
  ssr: false,
})

function App() {
  return <Document />
}
