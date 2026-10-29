import { getLayout } from '@/lib/layout'
import { useDocumentStore } from '@/lib/stores/document-store'
import { Page } from './page'
import { Editor } from './editor'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useProjectsStore } from '@/lib/stores/projects-store'
import { PAGE_GAP, pageTop, useCameraStore } from '@/lib/stores/camera-store'
import { useCanvas } from './canvas'
import { ZoomControls } from './zoom-controls'
import { getAnalysis } from '@/lib/words'
import { usePeekKey } from './reading-aids'
import { getDisplayText, useScriptStore } from '@/lib/script'

// pages rendered either side of the ones in view
const OVERSCAN = 1

export const Document = () => {
  const document = useDocumentStore()
  const project = useProjectsStore((state) => state.getActiveProject())
  const layout = getLayout(project.pt, document.columns)
  const analysis = getAnalysis(project.pt)
  // re-rendered once the converter for the script has loaded
  useScriptStore((state) => state.converters[document.script])
  const display = getDisplayText(project.pt, document.script)
  useEffect(() => {
    useScriptStore.getState().load(document.script)
  }, [document.script])
  usePeekKey()

  const linesPerPage = document.linesPerPage()

  // memoised so the pages' rows stay the same while the pages in view change
  const pages = useMemo(() => {
    const pages: (typeof layout.rows)[] = []
    for (let i = 0; i < layout.rows.length; i += linesPerPage) {
      pages.push(layout.rows.slice(i, i + linesPerPage))
    }
    return pages
  }, [layout, linesPerPage])

  const viewportRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  useCanvas(viewportRef, worldRef)

  // the pages are laid out once at 100%, zooming only moves the camera
  const pageWidth = document.pageWidth() * document.mmX
  const pageHeight = document.pageHeight() * document.mmY
  const contentHeight = pageTop(pages.length, pageHeight) - PAGE_GAP

  useLayoutEffect(() => {
    useCameraStore
      .getState()
      .setContent({ width: pageWidth, height: contentHeight })
  }, [pageWidth, contentHeight])

  // only the pages in view are rendered
  const [first, last] = useCameraStore(
    useShallow((camera) => {
      const top = -camera.y / camera.zoom
      const bottom = (camera.viewport.height - camera.y) / camera.zoom
      const toPage = (y: number) =>
        Math.min(
          Math.max(Math.floor(y / (pageHeight + PAGE_GAP)), 0),
          pages.length - 1,
        )
      return [
        Math.max(toPage(top) - OVERSCAN, 0),
        Math.min(toPage(bottom) + OVERSCAN, pages.length - 1),
      ]
    }),
  )

  const visiblePages: number[] = []
  for (let i = first; i <= last; i++) visiblePages.push(i)

  return (
    <div className="relative h-full">
      <Editor
        viewportRef={viewportRef}
        className="bg-muted/60 bg-[radial-gradient(var(--color-border)_1px,transparent_1px)]"
      >
        <div
          ref={worldRef}
          className="absolute top-0 left-0 origin-top-left"
          style={{ width: `${pageWidth}px`, height: `${contentHeight}px` }}
        >
          {visiblePages.map((pageIndex) => (
            <div
              key={pageIndex}
              className="absolute left-0 w-full"
              style={{ top: `${pageTop(pageIndex, pageHeight)}px` }}
            >
              <Page
                document={document}
                pageIndex={pageIndex}
                pageRows={pages[pageIndex]}
                layout={layout}
                analysis={analysis}
                display={display}
              />
            </div>
          ))}
        </div>
      </Editor>
      <ZoomControls />
    </div>
  )
}
