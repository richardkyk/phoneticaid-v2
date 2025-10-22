import { useDocumentStore } from '@/lib/stores/document-store'
import { Fragment } from 'react/jsx-runtime'
import { Cell } from '@/lib/render'
import { Cursor, Grid, Highlight } from './grid'

interface PageProps {
  pageIndex: number
  pageRows: Cell[][]
  rowsPerPage: number
  pieceMap: Map<string, string>
}
export const Page = (props: PageProps) => {
  const document = useDocumentStore()

  return (
    <div
      data-page={props.pageIndex}
      className="relative shadow-[0_0_0_1px_rgba(0,0,0,0.1)] select-none outline-none"
      style={{
        height: `${document.pageHeight}mm`,
        width: `${document.pageWidth}mm`,
      }}
    >
      <Margins />
      <Grid
        pageIndex={props.pageIndex}
        pageRows={props.pageRows}
        rowsPerPage={props.rowsPerPage}
      />
      <Cursor
        document={document}
        pieceMap={props.pieceMap}
        rowsPerPage={props.rowsPerPage}
        pageIndex={props.pageIndex}
      />
      <Highlight rowsPerPage={props.rowsPerPage} pageIndex={props.pageIndex} />
    </div>
  )
}

export const Margins = () => {
  const marginX = useDocumentStore((state) => state.marginX)
  const marginY = useDocumentStore((state) => state.marginY)

  return (
    <Fragment>
      {/* Margins */}
      <div
        className="border-x border-dashed absolute inset-y-0"
        style={{
          insetInline: `${marginX}mm`,
        }}
      ></div>
      <div
        className="border-y border-dashed absolute inset-x-0"
        style={{
          insetBlock: `${marginY}mm`,
        }}
      ></div>
    </Fragment>
  )
}
