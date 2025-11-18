import { useMapStore } from '@/lib/stores/cursor-store'
import { buildRows } from '@/lib/render'
import { useDocumentStore, useRowsStore } from '@/lib/stores/document-store'
import { useLayoutEffect } from '@tanstack/react-router'
import { Page } from './page'
import { Editor } from './editor'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'
import { useProjectsStore } from '@/lib/stores/projects-store'

export const Document = () => {
  const document = useDocumentStore()
  const project = useProjectsStore((state) => state.getActiveProject())
  const data = buildRows(project.pt, document)

  const pageHeight = document.pageHeight() * document.mmY
  const rowsPerPage = document.rowsPerPage()

  useLayoutEffect(() => {
    useRowsStore.getState().setRows(data.rowCount)
    useMapStore.getState().setPieceMap(data.pieceMap)
    useMapStore.getState().setGridMap(data.gridMap)
  }, [data])

  const pages: (typeof data.rows)[] = []
  for (let i = 0; i < data.rows.length; i += rowsPerPage) {
    pages.push(data.rows.slice(i, i + rowsPerPage))
  }

  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: pages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => pageHeight,
    overscan: 1,
  })

  return (
    <Editor scrollRef={parentRef}>
      <div className="py-6">
        <div
          className="mx-auto"
          style={{
            maxWidth: `${document.pageWidth() * document.mmX}px`,
            height: virtualizer.getTotalSize(),
            position: 'relative',
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
                  width: `${document.pageWidth() * document.mmX + 48}px`,
                }}
              >
                <Page
                  document={document}
                  pageIndex={pageIndex}
                  pageRows={pageRows}
                  pieceMap={data.pieceMap}
                />
              </div>
            )
          })}
        </div>
      </div>
    </Editor>
  )
}
