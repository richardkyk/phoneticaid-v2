import { getLayout } from '@/lib/layout'
import { useDocumentStore } from '@/lib/stores/document-store'
import { useLayoutEffect } from '@tanstack/react-router'
import { Page } from './page'
import { Editor } from './editor'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'
import { useProjectsStore } from '@/lib/stores/projects-store'

export const Document = () => {
  const document = useDocumentStore()
  const project = useProjectsStore((state) => state.getActiveProject())
  const layout = getLayout(project.pt, document.columns)

  const rowsPerPage = document.rowsPerPage()

  const pages: (typeof layout.rows)[] = []
  for (let i = 0; i < layout.rows.length; i += rowsPerPage) {
    pages.push(layout.rows.slice(i, i + rowsPerPage))
  }

  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: pages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => document.pageHeight() * document.mmY,
    overscan: 1,
    gap: 24,
  })

  useLayoutEffect(() => {
    // need to remeasure the virtualizer when the layout changes
    virtualizer.measure()
  }, [document.layout])

  return (
    <Editor scrollRef={parentRef}>
      <div className="py-6">
        <div
          className="mx-auto relative"
          style={{
            maxWidth: `${document.pageWidth() * document.mmX}px`,
            height: `${virtualizer.getTotalSize()}px`,
          }}
        >
          {virtualizer.getVirtualItems().map((virtualPage) => {
            const pageIndex = virtualPage.index
            const pageRows = pages[pageIndex]
            return (
              <div
                key={pageIndex}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  transform: `translateY(${virtualPage.start}px)`,
                  width: `${document.pageWidth() * document.mmX + 48}px`, // add 48px for padding
                }}
              >
                <Page
                  document={document}
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
  )
}
