import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: App,
})

function App() {
  return (
    <div className="container mx-auto p-6 flex items-center justify-center">
      <div className="relative border border-black/10 w-[210mm] h-[297mm]">
        <div className="border-x border-dashed inset-x-4 absolute inset-y-0"></div>
        <div className="border-y border-dashed inset-y-4 absolute inset-x-0"></div>
      </div>
    </div>
  )
}
