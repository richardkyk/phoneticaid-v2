import { DocumentStore } from '@/lib/stores/document-store'
import { Fragment } from 'react/jsx-runtime'
import { Cell, Layout } from '@/lib/layout'
import { Cursor, Grid, Highlight } from './grid'
import { memo } from 'react'
import type { TextAnalysis } from '@/lib/words'
import {
  clearHover,
  RevealedPinyin,
  trackHover,
  useHiddenPinyin,
  WordGroups,
} from './reading-aids'

interface PageProps {
  pageIndex: number
  pageRows: Cell[][]
  layout: Layout
  analysis: TextAnalysis
  // the text in the script it's drawn in, null to draw it as typed
  display: string | null
  document: DocumentStore
}
// memoised so pages already in view don't re-render as others come into view
export const Page = memo(function Page(props: PageProps) {
  const document = props.document
  const hidden = useHiddenPinyin(document, props.analysis)

  return (
    <div data-page={props.pageIndex} className="flex justify-center w-full">
      <div
        data-grid
        className="relative shrink-0 cursor-text bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.1)] select-none outline-none print:shadow-none page"
        style={{
          height: `${document.pageHeight() * document.mmY}px`,
          width: `${document.pageWidth() * document.mmX}px`,
        }}
        onPointerMove={trackHover}
        onPointerDown={trackHover}
        onPointerLeave={clearHover}
      >
        <Margins document={document} />
        <WordGroups
          document={document}
          pageRows={props.pageRows}
          analysis={props.analysis}
          hidden={hidden}
        />
        <Grid
          document={document}
          pageIndex={props.pageIndex}
          pageRows={props.pageRows}
          analysis={props.analysis}
          hidden={hidden}
          display={props.display}
        />
        <RevealedPinyin
          document={document}
          pageRows={props.pageRows}
          analysis={props.analysis}
          hidden={hidden}
        />
        <Cursor
          document={document}
          pageIndex={props.pageIndex}
          layout={props.layout}
        />
        <Highlight
          document={document}
          pageIndex={props.pageIndex}
          layout={props.layout}
        />
      </div>
    </div>
  )
})

interface MarginsProps {
  document: DocumentStore
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
          insetInline: `${marginX * props.document.mmX}px`,
        }}
      ></div>
      <div
        className="border-y border-dashed absolute inset-x-0 print:hidden"
        style={{
          insetBlock: `${marginY * props.document.mmY}px`,
        }}
      ></div>
    </Fragment>
  )
}
