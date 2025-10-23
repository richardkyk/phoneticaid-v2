import { useMapStore } from '@/lib/stores/cursor-store'
import { usePieceTableStore } from '@/lib/stores/piece-table-store'
import { buildRows } from '@/lib/render'
import { useDocumentStore, useRowsStore } from '@/lib/stores/document-store'
import { useLayoutEffect } from '@tanstack/react-router'
import { Page } from './page'
import { Editor } from './editor'

export const Document = () => {
  const document = useDocumentStore()
  const pt = usePieceTableStore((state) => state.pt)
  const data = buildRows(pt, document)

  const rowHeight =
    (document.fontSize +
      document.gapY +
      document.pinyinSize +
      document.pinyinOffset) *
    document.mmY
  const pageHeight = document.pageHeight * document.mmY // define in your store
  const rowsPerPage = Math.floor(
    (pageHeight - document.marginY * 2 * document.mmY) / rowHeight,
  )

  useLayoutEffect(() => {
    useRowsStore.getState().setRows(data.rowCount)
    useMapStore.getState().setPieceMap(data.pieceMap)
    useMapStore.getState().setGridMap(data.gridMap)
  }, [data])

  // chunk rows into pages
  const pages: (typeof data.rows)[] = []
  for (let i = 0; i < data.rows.length; i += rowsPerPage) {
    pages.push(data.rows.slice(i, i + rowsPerPage))
  }

  return (
    <Editor>
      {pages.map((pageRows, pageIndex) => (
        <Page
          key={`${pageIndex}`}
          pageIndex={pageIndex}
          pageRows={pageRows}
          rowsPerPage={rowsPerPage}
          pieceMap={data.pieceMap}
        />
      ))}
    </Editor>
  )
}
