import { Editor } from '@/components/editor'
import { Grid, Margins } from '@/components/grid'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: App,
})

function App() {
  return (
    <div className="container mx-auto p-6 flex items-center justify-center">
      <Editor>
        <Margins />
        <Grid />
      </Editor>
    </div>
  )
}
