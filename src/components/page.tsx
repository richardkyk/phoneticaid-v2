import { DocumentState } from '@/lib/stores/document-store'
import { Fragment } from 'react/jsx-runtime'
import { Cell } from '@/lib/render'
import { Cursor, Grid, Highlight } from './grid'

interface PageProps {
  pageIndex: number
  pageRows: Cell[][]
  pieceMap: Map<string, string>
  document: DocumentState
}
export const Page = (props: PageProps) => {
  const document = props.document

  return (
    <div data-page={props.pageIndex} className="flex justify-center w-full">
      <div
        data-grid
        className="relative shrink-0 shadow-[0_0_0_1px_rgba(0,0,0,0.1)] select-none outline-none"
        style={{
          height: `${document.pageHeight}mm`,
          width: `${document.pageWidth}mm`,
        }}
      >
        <Margins document={document} />
        <Grid
          document={document}
          pageIndex={props.pageIndex}
          pageRows={props.pageRows}
        />
        <Cursor
          document={document}
          pageIndex={props.pageIndex}
          pieceMap={props.pieceMap}
        />
        <Highlight document={document} pageIndex={props.pageIndex} />
      </div>
    </div>
  )
}

interface MarginsProps {
  document: DocumentState
}
export const Margins = (props: MarginsProps) => {
  const marginX = props.document.marginX
  const marginY = props.document.marginY

  return (
    <Fragment>
      {/* Margins */}
      <div
        className="border-x border-dashed absolute inset-y-0 print:hidden"
        style={{
          insetInline: `${marginX}mm`,
        }}
      ></div>
      <div
        className="border-y border-dashed absolute inset-x-0 print:hidden"
        style={{
          insetBlock: `${marginY}mm`,
        }}
      ></div>
    </Fragment>
  )
}
