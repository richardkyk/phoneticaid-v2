import { getLayout } from '@/lib/layout'
import { useDocumentStore } from '@/lib/stores/document-store'
import { useLayoutEffect } from '@tanstack/react-router'
import { Page } from './page'
import { Editor } from './editor'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useMemo, useRef } from 'react'
import { useProjectsStore } from '@/lib/stores/projects-store'
import { useUiStore } from '@/lib/stores/ui-store'
import { ZoomControls } from './zoom-controls'

const PAGE_GAP = 24 // px between pages at 100%
const PADDING = 24 // px around the pages

export const Document = () => {
  const document = useDocumentStore()
  const zoom = useUiStore((state) => state.zoom)
  const project = useProjectsStore((state) => state.getActiveProject())
  const layout = getLayout(project.pt, document.columns)

  // zooming scales the mm -> px conversion, so everything drawn in mm
  // (pages, characters, caret, highlights) scales with it
  const view = useMemo(
    () => ({ ...document, mmX: document.mmX * zoom, mmY: document.mmY * zoom }),
    [document, zoom],
  )

  const linesPerPage = document.linesPerPage()

  const pages: (typeof layout.rows)[] = []
  for (let i = 0; i < layout.rows.length; i += linesPerPage) {
    pages.push(layout.rows.slice(i, i + linesPerPage))
  }

  const parentRef = useRef<HTMLDivElement>(null)

  const pageWidth = view.pageWidth() * view.mmX
  const pageHeight = view.pageHeight() * view.mmY

  const virtualizer = useVirtualizer({
    count: pages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => pageHeight,
    overscan: 1,
    gap: PAGE_GAP * zoom,
  })

  useLayoutEffect(() => {
    // need to remeasure the virtualizer when the page size changes
    virtualizer.measure()
  }, [pageHeight, zoom])

  return (
    <div className="relative h-full bg-muted/60 bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] bg-size-[16px_16px]">
      <Editor scrollRef={parentRef}>
        {/* w-max lets the pages scroll sideways when zoomed in, min-w-full centres them otherwise */}
        <div className="w-max min-w-full" style={{ padding: PADDING }}>
          <div
            className="mx-auto relative"
            style={{
              width: `${pageWidth}px`,
              height: `${virtualizer.getTotalSize()}px`,
            }}
          >
            {virtualizer.getVirtualItems().map((virtualPage) => {
              const pageIndex = virtualPage.index
              const pageRows = pages[pageIndex]
              return (
                <div
                  key={pageIndex}
                  className="absolute top-0 left-0 w-full"
                  style={{ transform: `translateY(${virtualPage.start}px)` }}
                >
                  <Page
                    document={view}
                    pageIndex={pageIndex}
                    pageRows={pageRows}
                    layout={layout}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </Editor>
      <ZoomControls scrollRef={parentRef} padding={PADDING} />
    </div>
  )
}
