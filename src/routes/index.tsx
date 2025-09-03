import { renderRow } from '@/lib/render'
import { useContentStore, useDocumentStore } from '@/lib/store'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: App,
})

function App() {
  const document = useDocumentStore()

  const { rows, originalBuffer, addBuffer } = useContentStore()

  return (
    <div className="container mx-auto p-6 flex items-center justify-center">
      <div className="relative shadow-[0_0_0_1px_rgba(0,0,0,0.5)] w-[210mm] h-[297mm]">
        {/* Margins */}
        <div
          className="border-x border-dashed absolute inset-y-0"
          style={{
            insetInline: `${document.marginX}mm`,
          }}
        ></div>
        <div
          className="border-y border-dashed absolute inset-x-0"
          style={{
            insetBlock: `${document.marginY}mm`,
          }}
        ></div>

        {/* Content */}

        {rows.map((row, i) => {
          const _row = {
            pieces: row.pieces,
            originalBuffer,
            addBuffer,
          }
          const cells = renderRow(i, _row, document)
          return (
            <div key={i} className="">
              {cells.map((cell, j) => {
                return (
                  <div
                    key={j}
                    className="absolute shadow-[0_0_0_1px_rgba(0,0,0,0.05)] text-black"
                    style={{
                      top: `${cell.y}mm`,
                      left: `${cell.x}mm`,
                      width: `${cell.width}mm`,
                      height: `${cell.height}mm`,
                      fontSize: `${cell.width}mm`,
                      lineHeight: 0.93,
                    }}
                  >
                    {cell.content}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
