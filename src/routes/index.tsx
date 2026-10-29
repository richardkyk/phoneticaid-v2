import { ProjectsOverview } from '@/components/projects-overview'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: ProjectsOverview,
  // projects are stored in the browser
  ssr: false,
})
